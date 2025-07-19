# === model/simple_mlp.py ===
import torch.nn as nn

class SimpleMLP(nn.Module):
    def __init__(self, input_dim, output_dim):
        super().__init__()
        self.model = nn.Sequential(
            nn.Linear(input_dim, 128),
            nn.ReLU(),
            nn.Linear(128, 64),
            nn.ReLU(),
            nn.Linear(64, output_dim),
            nn.Sigmoid()  # 输出为动作向量概率
        )

    def forward(self, x):
        return self.model(x)
