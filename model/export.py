# === model/export.py ===
import json
import torch
import numpy as np

def export_weights(model, filepath='output/weights.json'):
    def round_nested(arr):
        if isinstance(arr, list):
            return [round_nested(x) for x in arr]
        elif isinstance(arr, float):
            return round(arr, 3)
        else:
            return arr

    # 提取最后一层（第3个Linear）的权重
    if isinstance(model.model[-2], torch.nn.Linear):  # 倒数第2是 Linear，第1是 Sigmoid
        last_layer = model.model[-2]
        W = last_layer.weight.detach().cpu().numpy().tolist()  # shape: [54, 64]
        b = last_layer.bias.detach().cpu().numpy().tolist()    # shape: [54]

        weights = {
            "W2": round_nested(W),
            "b2": round_nested(b)
        }

        with open(filepath, 'w') as f:
            json.dump(weights, f, separators=(',', ':'))  # 紧凑写法减少体积
        print(f"✅ 仅导出输出层权重 W2({len(W)}x{len(W[0])}) 和 b2({len(b)}) ➜ {filepath}")
    else:
        raise ValueError("模型结构意外，最后一层不是 Linear")
