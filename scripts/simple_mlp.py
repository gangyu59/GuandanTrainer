# === scripts/simple_mlp.py ===
import torch.nn as nn
from collections import OrderedDict

class SimpleMLP(nn.Module):
    def __init__(self, input_dim, output_dim):
        super().__init__()
        self.model = nn.Sequential(
            OrderedDict([
                ('layer0', nn.Linear(input_dim, 128)),
                ('relu0', nn.ReLU()),
                ('hidden', nn.Linear(128, 64)),
                ('relu1', nn.ReLU()),
                ('layer2', nn.Linear(64, output_dim)),
                ('sigmoid', nn.Sigmoid())
            ])
        )

    def forward(self, x):
        return self.model(x)