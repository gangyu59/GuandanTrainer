# === scripts/trainer.py ===
import torch
import torch.nn as nn
import torch.optim as optim
from .simple_mlp import SimpleMLP



def train_model(X, y, epochs=10, status=None):
    print(f"🔧 训练模型输入检查: X.shape={X.shape}, y.shape={y.shape}")
    from scripts.simple_mlp import SimpleMLP
    import torch
    import torch.nn as nn
    import torch.optim as optim

    model = SimpleMLP(input_dim=X.shape[1], output_dim=y.shape[1])
    criterion = nn.BCELoss()
    optimizer = optim.Adam(model.parameters(), lr=0.001)

    X_tensor = torch.tensor(X, dtype=torch.float32)
    y_tensor = torch.tensor(y, dtype=torch.float32)

    for epoch in range(epochs):
        outputs = model(X_tensor)
        loss = criterion(outputs, y_tensor)

        optimizer.zero_grad()
        loss.backward()
        optimizer.step()

        if status is not None:
            status["epoch"] = epoch + 1

        print(f"Epoch {epoch + 1}/{epochs} - Loss: {loss.item():.4f}")

    return model
