import torch
import torch.nn as nn
import torch.optim as optim
import numpy as np
from .simple_mlp import SimpleMLP


def train_model(X, y, epochs=50, status=None, log_callback=None):
    print(f"🔧 训练模型输入检查: X.shape={X.shape}, y.shape={y.shape}")

    model = SimpleMLP(input_dim=X.shape[1], output_dim=y.shape[1])
    criterion = nn.BCELoss()
    optimizer = optim.Adam(model.parameters(), lr=0.001)

    X_tensor = torch.from_numpy(X).float()
    y_tensor = torch.from_numpy(y).float()

    # ✅ 初始化 action 分布统计
    action_counter = np.zeros(y.shape[1], dtype=np.float32)
    total_correct = 0
    total_samples = 0
    entropies = []

    for epoch in range(epochs):
        outputs = model(X_tensor)
        loss = criterion(outputs, y_tensor)

        optimizer.zero_grad()
        loss.backward()
        optimizer.step()

        if status is not None:
            status["epoch"] = epoch + 1

        log_line = f"📉 Epoch {epoch + 1}/{epochs} - Loss: {loss.item():.4f}"
        print(log_line)

        if log_callback:
            log_callback(log_line)

        # ✅ 附加指标统计（每轮）
        probs = outputs.detach().numpy()
        labels = y_tensor.numpy()

        # action 分布（取每行最大值对应索引作为选择动作）
        preds = np.argmax(probs, axis=1)
        truths = np.argmax(labels, axis=1)
        for p in preds:
            action_counter[p] += 1

        # 策略熵（每个样本的分布熵，取平均）
        entropy_batch = -np.sum(probs * np.log(probs + 1e-8), axis=1)
        entropies.append(np.mean(entropy_batch))

        # 准确率
        total_correct += np.sum(preds == truths)
        total_samples += len(preds)

    # ✅ 训练完成后更新 status["metrics"]
    if status is not None:
        status.update({
            "metrics": {
                "samples": len(X),
                "winrate": status.get("metrics", {}).get("winrate", 0),
                "action_dist": {int(k): float(v) for k, v in enumerate(action_counter) if v > 0},
                "accuracy": round(total_correct / total_samples, 4),
                "entropy": round(np.mean(entropies), 4),
            }
        })
