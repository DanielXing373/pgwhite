#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
PGWhite 1.42 — Qwen3 embedding worker (Sentence Transformers).

Protocol (line-delimited JSON over stdin/stdout):
  Request:  {"op":"metadata"} | {"op":"embed","texts":[...]} | {"op":"shutdown"}
  Response: {"ok":true,...} or {"ok":false,"error":"..."}

Does not silently fall back from CUDA to CPU when require_cuda is true.
"""
from __future__ import annotations

import argparse
import json
import sys
from typing import Any


def emit(obj: dict[str, Any]) -> None:
    sys.stdout.write(json.dumps(obj, ensure_ascii=False) + "\n")
    sys.stdout.flush()


def fail(message: str, code: int = 1) -> None:
    emit({"ok": False, "error": message})
    raise SystemExit(code)


def parse_args(argv: list[str]) -> argparse.Namespace:
    p = argparse.ArgumentParser(description="PGWhite Qwen3 embedding worker")
    p.add_argument("--model", default="Qwen/Qwen3-Embedding-0.6B")
    p.add_argument(
        "--device",
        default=None,
        help='Optional torch device string, e.g. "cuda" or "cuda:0". '
        "If omitted: cuda when available (or fail when --require-cuda).",
    )
    p.add_argument(
        "--require-cuda",
        action="store_true",
        help="Fail if CUDA is unavailable. Do not silently use CPU.",
    )
    p.add_argument(
        "--normalize-embeddings",
        action=argparse.BooleanOptionalAction,
        default=True,
    )
    p.add_argument("--batch-size", type=int, default=32)
    p.add_argument(
        "--trust-remote-code",
        action=argparse.BooleanOptionalAction,
        default=True,
        help="Forwarded to SentenceTransformer (Qwen models often need this).",
    )
    return p.parse_args(argv)


def resolve_device(requested: str | None, require_cuda: bool) -> str:
    try:
        import torch
    except Exception as exc:  # noqa: BLE001
        fail(f"PyTorch is not importable: {exc}")

    cuda_available = bool(torch.cuda.is_available())
    if require_cuda and not cuda_available:
        fail(
            "CUDA is required (require_cuda=true) but torch.cuda.is_available() is False. "
            "Install a CUDA-enabled PyTorch build and verify the GPU driver."
        )

    if requested:
        device = requested
        if require_cuda and not str(device).startswith("cuda"):
            fail(
                f"require_cuda=true but configured device is {device!r}. "
                "Use a cuda device or unset device to auto-select CUDA."
            )
        if str(device).startswith("cuda") and not cuda_available:
            fail(f"Configured device {device!r} but CUDA is unavailable.")
        return device

    return "cuda" if cuda_available else "cpu"


def load_model(args: argparse.Namespace):
    device = resolve_device(args.device, args.require_cuda)
    try:
        from sentence_transformers import SentenceTransformer
    except Exception as exc:  # noqa: BLE001
        fail(
            "sentence-transformers is not importable. "
            "Create a venv and install research/retrieval/runner/python/requirements-qwen3.txt "
            f"after installing CUDA PyTorch. Underlying error: {exc}"
        )

    try:
        model = SentenceTransformer(
            args.model,
            device=device,
            trust_remote_code=args.trust_remote_code,
        )
    except Exception as exc:  # noqa: BLE001
        fail(f"Failed to load model {args.model!r} on device {device!r}: {exc}")

    meta = collect_metadata(args, model, device)
    return model, meta


def collect_metadata(args: argparse.Namespace, model, device: str) -> dict[str, Any]:
    import torch

    revision = None
    try:
        revision = getattr(getattr(model, "model", None), "config", None)
        revision = getattr(revision, "_name_or_path", None) or revision
    except Exception:  # noqa: BLE001
        revision = None

    # Prefer HF model card / config revision when exposed
    model_revision = None
    try:
        model_revision = getattr(model, "model_card_data", None)
    except Exception:  # noqa: BLE001
        model_revision = None

    dim = None
    try:
        dim = int(model.get_sentence_embedding_dimension())
    except Exception:  # noqa: BLE001
        dim = None

    gpu_name = None
    cuda_device_id = None
    if str(device).startswith("cuda") and torch.cuda.is_available():
        try:
            idx = torch.cuda.current_device()
            cuda_device_id = int(idx)
            gpu_name = torch.cuda.get_device_name(idx)
        except Exception:  # noqa: BLE001
            pass

    return {
        "provider_id": "qwen3-embedding",
        "model_name": args.model,
        "model_revision": str(model_revision) if model_revision else None,
        "model_identifier": args.model,
        "loaded_name_or_path": str(revision) if revision else args.model,
        "dimensions": dim,
        "device": device,
        "normalize_embeddings": bool(args.normalize_embeddings),
        "batch_size": int(args.batch_size),
        "trust_remote_code": bool(args.trust_remote_code),
        "require_cuda": bool(args.require_cuda),
        "cuda_available": bool(torch.cuda.is_available()),
        "cuda_device_count": int(torch.cuda.device_count()) if torch.cuda.is_available() else 0,
        "cuda_device_id": cuda_device_id,
        "gpu_name": gpu_name,
        "torch_version": getattr(torch, "__version__", None),
        "sentence_transformers_version": _st_version(),
        "backend": "sentence-transformers",
    }


def _st_version() -> str | None:
    try:
        import sentence_transformers as st

        return getattr(st, "__version__", None)
    except Exception:  # noqa: BLE001
        return None


def embed_texts(model, texts: list[str], args: argparse.Namespace) -> list[list[float]]:
    if not isinstance(texts, list) or any(not isinstance(t, str) for t in texts):
        fail("embed.texts must be an array of strings")
    try:
        vectors = model.encode(
            texts,
            batch_size=int(args.batch_size),
            normalize_embeddings=bool(args.normalize_embeddings),
            convert_to_numpy=True,
            show_progress_bar=False,
        )
    except Exception as exc:  # noqa: BLE001
        fail(f"model.encode failed: {exc}")

    out: list[list[float]] = []
    for row in vectors:
        out.append([float(x) for x in row.tolist()])
    return out


def main(argv: list[str]) -> None:
    # Force UTF-8 stdio for Windows consoles
    try:
        sys.stdin.reconfigure(encoding="utf-8")
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:  # noqa: BLE001
        pass

    args = parse_args(argv)
    model, meta = load_model(args)
    emit({"ok": True, "event": "ready", "metadata": meta})

    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            req = json.loads(line)
        except json.JSONDecodeError as exc:
            emit({"ok": False, "error": f"Invalid JSON request: {exc}"})
            continue

        op = req.get("op")
        if op == "metadata":
            emit({"ok": True, "metadata": meta})
        elif op == "embed":
            texts = req.get("texts")
            try:
                vectors = embed_texts(model, texts, args)
            except SystemExit:
                return
            except Exception as exc:  # noqa: BLE001
                emit({"ok": False, "error": str(exc)})
                continue
            emit(
                {
                    "ok": True,
                    "vectors": vectors,
                    "count": len(vectors),
                    "dimensions": len(vectors[0]) if vectors else meta.get("dimensions"),
                }
            )
        elif op == "shutdown":
            emit({"ok": True, "event": "shutdown"})
            return
        else:
            emit({"ok": False, "error": f"Unknown op: {op!r}"})


if __name__ == "__main__":
    try:
        main(sys.argv[1:])
    except SystemExit:
        raise
    except Exception as exc:  # noqa: BLE001
        fail(f"Unhandled worker error: {exc}")
