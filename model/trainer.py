# === model/trainer.py ===
import torch
from torch.utils.data import DataLoader, TensorDataset

from model.plot import plot_training_history
from model.simple_mlp import SimpleMLP
import torch.nn.functional as F
import torch.optim as optim
from sklearn.model_selection import train_test_split
import numpy as np

def train_model(X, y, epochs=10, batch_size=32):
    history = {
        "train_loss": [],
        "val_loss": [],
        "top1_acc": []
    }

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"📊 开始训练模型：样本数 = {len(X)}, 输入维度 = {X.shape[1]}, 输出维度 = {y.shape[1]}")
    model = SimpleMLP(X.shape[1], y.shape[1]).to(device)

    # ✅ 拆分训练集与验证集
    X_train, X_val, y_train, y_val = train_test_split(
        X, y, test_size=0.2, random_state=42
    )

    train_dataset = TensorDataset(
        torch.tensor(X_train, dtype=torch.float32),
        torch.tensor(y_train, dtype=torch.float32)
    )
    val_dataset = TensorDataset(
        torch.tensor(X_val, dtype=torch.float32),
        torch.tensor(y_val, dtype=torch.float32)
    )

    train_loader = DataLoader(train_dataset, batch_size=batch_size, shuffle=True)
    val_loader = DataLoader(val_dataset, batch_size=batch_size)

    optimizer = optim.Adam(model.parameters(), lr=0.001)

    for epoch in range(epochs):
        model.train()
        total_loss = 0
        for batch_X, batch_y in train_loader:
            batch_X, batch_y = batch_X.to(device), batch_y.to(device)
            pred_y = model(batch_X)
            loss = F.mse_loss(pred_y, batch_y)
            optimizer.zero_grad()
            loss.backward()
            optimizer.step()
            total_loss += loss.item()
        avg_train_loss = total_loss / len(train_loader)

        # ✅ 验证阶段
        model.eval()
        val_loss = 0
        correct = 0
        total = 0
        with torch.no_grad():
            for val_X, val_y in val_loader:
                val_X, val_y = val_X.to(device), val_y.to(device)
                pred_y = model(val_X)
                loss = F.mse_loss(pred_y, val_y)
                val_loss += loss.item()

                # 比较 argmax
                pred_idx = pred_y.argmax(dim=1).cpu().numpy()
                true_idx = val_y.argmax(dim=1).cpu().numpy()
                correct += np.sum(pred_idx == true_idx)
                total += len(true_idx)

        val_loss /= len(val_loader)
        acc = correct / total * 100

        history["train_loss"].append(avg_train_loss)
        history["val_loss"].append(val_loss)
        history["top1_acc"].append(acc)

        print(f"🎯 Epoch {epoch+1}/{epochs}, "
              f"Train Loss: {avg_train_loss:.4f}, "
              f"Val Loss: {val_loss:.4f}, "
              f"Top-1 Accuracy: {acc:.2f}%")

        plot_training_history(history)

    return model
