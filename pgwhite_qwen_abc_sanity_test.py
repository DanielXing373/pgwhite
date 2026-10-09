from sentence_transformers import SentenceTransformer

model = SentenceTransformer("Qwen/Qwen3-Embedding-0.6B", device="cuda")

quote = "听到这首旧歌，我突然想起小时候住过的房间。"

representations = {
    "记忆": {
        "A": "记忆",
        "B": "记忆：记住、回想与被过去经验塑造的心智领地，可涵盖回忆唤起、保存与改变。",
        "C": "记忆：记住、回想与被过去经验塑造的心智领地，可涵盖回忆唤起、保存与改变。｜别名：回忆",
    },
    "童年": {
        "A": "童年",
        "B": "童年：儿童时期的经验、感知与回忆。",
        "C": "童年：儿童时期的经验、感知与回忆。｜别名：幼年",
    },
    "音乐": {
        "A": "音乐",
        "B": "音乐：音乐作为情感、记忆与意义的载体。",
        "C": "音乐：音乐作为情感、记忆与意义的载体。｜别名：乐曲",
    },
    "战争": {
        "A": "战争",
        "B": "战争：武装冲突及其伦理与创伤。",
        "C": "战争：武装冲突及其伦理与创伤。｜别名：战乱",
    },
}

quote_embedding = model.encode([quote], normalize_embeddings=True)[0]

print("\nQUOTE:")
print(quote)
print("\nRESULTS:")
print(f"{'Theme':<8} {'A':>8} {'B':>8} {'C':>8}")

for theme, reps in representations.items():
    scores = {}
    for rep_name, rep_text in reps.items():
        tag_embedding = model.encode([rep_text], normalize_embeddings=True)[0]
        scores[rep_name] = float(quote_embedding @ tag_embedding)

    print(f"{theme:<8} {scores['A']:>8.4f} {scores['B']:>8.4f} {scores['C']:>8.4f}")
