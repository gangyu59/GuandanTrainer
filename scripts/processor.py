# === scripts/processor.py ===
import numpy as np
from collections import Counter

def clean_dataset(data):
    cleaned = []
    for i, sample in enumerate(data[:10]):  # 打印前10个样本的情况
        state = sample.get("state")
        action = sample.get("action")

        print(f"样本 {i + 1}: state类型={type(state)}, 长度={len(state) if isinstance(state, list) else 'N/A'}")
        print(f"         action类型={type(action)}, 长度={len(action) if isinstance(action, list) else 'N/A'}")
        print(f"         sum(action)={sum(action) if isinstance(action, list) else 'N/A'}")

    for i, sample in enumerate(data):
        state = sample.get("state")
        action = sample.get("action")

        if (
            isinstance(state, list) and isinstance(action, list)
            and len(state) == 340
            and len(action) == 54
            and sum(action) > 0
            and all(0 <= v <= 1 for v in action)  # ✅ 保证 action 项均在 0~1 范围内
        ):
            cleaned.append(sample)
        else:
            if isinstance(action, list) and len(action) == 54:
                for j, v in enumerate(action):
                    if not (0 <= v <= 1):
                        print(f"🚫 第{i+1}条 action 第{j}项不在[0,1]范围: {v}")

    print(f"🧹 清洗后数据量: {len(cleaned)} / {len(data)}")
    return cleaned



def parse_dataset(data):
    X, y, meta = [], [], []
    for sample in data:
        X.append(sample["state"])
        # ✅ 强制转换为 float32，确保兼容 PyTorch
        action = [float(min(1.0, max(0.0, v))) for v in sample["action"]]
        y.append(action)
        meta.append(sample.get("meta", {}))
    return np.array(X, dtype=np.float32), np.array(y, dtype=np.float32), meta



from collections import Counter
import numpy as np

def analyze_meta(meta, y):
    wins, total = 0, 0
    action_counter = Counter()
    total_labels = 0
    correct_labels = 0

    for i, m in enumerate(meta):
        # 胜率计算
        if 'winner' in m and 'playerIndex' in m:
            if (m['playerIndex'] % 2 == 0 and m['winner'] == 'self') or \
               (m['playerIndex'] % 2 == 1 and m['winner'] == 'opponent'):
                wins += 1
            total += 1

        # 动作分布统计 + 准确率统计
        for idx, val in enumerate(y[i]):
            if val > 0:
                action_counter[idx] += val
                correct_labels += 1  # 每个标签值 > 0 都视为目标动作
        total_labels += np.count_nonzero(y[i] >= 0)

    # 计算胜率
    winrate = wins / total if total > 0 else 0
    # 计算准确率
    accuracy = correct_labels / total_labels if total_labels > 0 else 0

    # 计算策略熵
    action_values = np.array(list(action_counter.values()), dtype=np.float32)
    if action_values.sum() > 0:
        probs = action_values / action_values.sum()
        entropy = -np.sum(probs * np.log2(probs + 1e-12))  # 加上 1e-12 避免 log(0)
    else:
        entropy = 0.0

    # 输出统计结果
    print(f"🏁 胜率: {wins}/{total} = {winrate:.2%}")
    print(f"🎯 准确率: {accuracy:.2%}")
    print(f"📊 策略熵: {entropy:.4f}")
    print(f"🔥 Top actions: {action_counter.most_common(5)}")

    return {
        "winrate": float(winrate),  # 强制转换为 Python 原生 float
        "accuracy": float(accuracy),
        "entropy": float(entropy),
        "action_dist": {int(k): float(v) for k, v in action_counter.items()}  # 转换为可序列化格式
    }

