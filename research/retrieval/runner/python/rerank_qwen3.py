#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Line-delimited JSON worker for local Qwen3 Reranker via Sentence Transformers."""
from __future__ import annotations

import argparse
import json
import sys
from typing import Any


INSTRUCTION = (
    "Given a Chinese literary quotation, rank candidate theme descriptions "
    "by whether their meaning is expressed or strongly implied. "
    "Do not reward keyword overlap alone."
)


def emit(value: dict[str, Any]) -> None:
    sys.stdout.write(json.dumps(value, ensure_ascii=False) + "\n")
    sys.stdout.flush()


def main() -> None:
    try:
        sys.stdin.reconfigure(encoding="utf-8")
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

    parser = argparse.ArgumentParser()
    parser.add_argument("--model", required=True)
    parser.add_argument("--device", default="cuda")
    parser.add_argument("--batch-size", type=int, default=8)
    args = parser.parse_args()

    try:
        import torch
        from sentence_transformers import CrossEncoder
    except Exception as exc:
        emit({"ok": False, "error": f"Cannot import reranker dependencies: {exc}"})
        raise SystemExit(1)

    if args.device.startswith("cuda") and not torch.cuda.is_available():
        emit({"ok": False, "error": "CUDA requested but torch.cuda.is_available() is false"})
        raise SystemExit(1)

    try:
        model = CrossEncoder(
            args.model,
            device=args.device,
            prompts={"literary_theme": INSTRUCTION},
            default_prompt_name="literary_theme",
        )
    except Exception as exc:
        emit({"ok": False, "error": f"Failed to load reranker: {exc}"})
        raise SystemExit(1)

    emit({
        "ok": True,
        "event": "ready",
        "metadata": {
            "provider_id": "qwen3-reranker-local",
            "model_name": args.model,
            "device": str(model.device),
            "torch_version": torch.__version__,
            "sentence_transformers_version": getattr(
                __import__("sentence_transformers"), "__version__", None
            ),
            "instruction": INSTRUCTION,
            "batch_size": args.batch_size,
        },
    })

    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            request = json.loads(line)
            if request.get("op") == "shutdown":
                emit({"ok": True, "event": "shutdown"})
                return
            if request.get("op") != "rerank":
                emit({"ok": False, "error": f"Unknown op: {request.get('op')!r}"})
                continue
            query = request.get("query")
            documents = request.get("documents")
            if not isinstance(query, str) or not isinstance(documents, list):
                emit({"ok": False, "error": "rerank requires query:string and documents:array"})
                continue
            if any(not isinstance(doc, str) for doc in documents):
                emit({"ok": False, "error": "All rerank documents must be strings"})
                continue
            pairs = [(query, document) for document in documents]
            scores = model.predict(
                pairs,
                batch_size=args.batch_size,
                show_progress_bar=False,
            )
            emit({"ok": True, "scores": [float(score) for score in scores]})
        except Exception as exc:
            emit({"ok": False, "error": str(exc)})


if __name__ == "__main__":
    main()
