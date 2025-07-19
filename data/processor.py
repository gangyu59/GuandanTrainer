import numpy as np

def clean_array(arr, default=0):
    return [x if isinstance(x, (int, float)) and x is not None else default for x in arr]

def parse_dataset(raw_data):
    X, y, meta = [], [], []

    for entry in raw_data:
        state = entry.get("state")
        action = entry.get("action")

        if not isinstance(state, list) or not isinstance(action, list):
            continue

        state = clean_array(state)
        action = clean_array(action)

        X.append(state)
        y.append(action)
        meta.append(entry.get("meta", {}))

    X_arr = np.array(X)
    y_arr = np.array(y)

    print(f"✅ 成功解析数据: X={X_arr.shape}, y={y_arr.shape}, meta={len(meta)} 条")
    return X_arr, y_arr, meta

def analyze_meta(meta):
    # meta 是 list，每个样本有 meta 数据
    wins = 0
    total = 0

    for m in meta:
        if 'winner' in m and 'playerIndex' in m:
            if (m['playerIndex'] % 2 == 0 and m['winner'] == 'self') or \
                    (m['playerIndex'] % 2 == 1 and m['winner'] == 'opponent'):
                wins += 1
            total += 1

    print(f"🏁 胜率: {wins}/{total} = {wins / total:.2%}")


# data/processor.py

def clean_dataset(data):
    """
    清洗训练样本：
    - state 长度必须为 288
    - action 长度必须为 54，且不能是全 0
    """
    cleaned = []
    for sample in data:
        state = sample.get("state")
        action = sample.get("action")
        if (
            isinstance(state, list) and isinstance(action, list)
            and len(state) == 288 and len(action) == 54
            and sum(action) > 0
        ):
            cleaned.append(sample)
    print(f"🧹 清洗后数据量: {len(cleaned)} / {len(data)}")
    return cleaned

