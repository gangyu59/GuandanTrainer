import torch


def evaluate_accuracy(model, X, y, threshold=0.5):
    with torch.no_grad():
        X_tensor = torch.tensor(X, dtype=torch.float32)
        y_tensor = torch.tensor(y, dtype=torch.float32)
        preds = model(X_tensor)
        correct = (preds > threshold) == (y_tensor > threshold)
        acc = correct.float().mean().item()
        print(f"📊 评估准确率: {acc:.2%}")
        return acc
