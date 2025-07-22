# === scripts/processor.py ===
import numpy as np


def clean_dataset(data):
    cleaned = []
    for i, sample in enumerate(data[:10]):  # 打印前10个样本的情况
        state = sample.get("state")
        action = sample.get("action")

        print(f"样本 {i + 1}: state类型={type(state)}, 长度={len(state) if isinstance(state, list) else 'N/A'}")
        print(f"         action类型={type(action)}, 长度={len(action) if isinstance(action, list) else 'N/A'}")
        print(f"         sum(action)={sum(action) if isinstance(action, list) else 'N/A'}")

    # 正式清洗逻辑
    for i, sample in enumerate(data):
        state = sample.get("state")
        action = sample.get("action")

        if (
                isinstance(state, list) and isinstance(action, list)
                and len(state) == 340
                and len(action) == 54
                and sum(action) > 0
        ):
            cleaned.append(sample)

    print(f"🧹 清洗后数据量: {len(cleaned)} / {len(data)}")
    return cleaned


def parse_dataset(data):
    X, y, meta = [], [], []
    for sample in data:
        X.append(sample["state"])
        y.append(sample["action"])
        meta.append(sample.get("meta", {}))
    return np.array(X), np.array(y), meta


def analyze_meta(meta):
    wins, total = 0, 0
    for m in meta:
        if 'winner' in m and 'playerIndex' in m:
            if (m['playerIndex'] % 2 == 0 and m['winner'] == 'self') or \
               (m['playerIndex'] % 2 == 1 and m['winner'] == 'opponent'):
                wins += 1
            total += 1
    if total > 0:
        print(f"🏁 胜率: {wins}/{total} = {wins / total:.2%}")
