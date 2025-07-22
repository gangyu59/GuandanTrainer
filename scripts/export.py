# === scripts/export.py ===
import torch
import json


def export_weights(model, filepath='output/model_weights.json'):
    def round_nested(arr):
        if isinstance(arr, list):
            return [round_nested(x) for x in arr]
        elif isinstance(arr, float):
            return round(arr, 3)
        else:
            return arr

    # ✅ 修复此处：找最后一个 Linear 层
    linear_layers = [m for m in model.model if isinstance(m, torch.nn.Linear)]
    if not linear_layers:
        raise ValueError("模型中找不到 Linear 层")
    last_layer = linear_layers[-1]

    W = last_layer.weight.detach().cpu().numpy().tolist()
    b = last_layer.bias.detach().cpu().numpy().tolist()

    weights = {
        "W2": round_nested(W),
        "b2": round_nested(b)
    }

    with open(filepath, 'w') as f:
        json.dump(weights, f, separators=(',', ':'))
    print(f"✅ 导出到 {filepath}，权重维度: W2={len(W)}x{len(W[0])}, b2={len(b)}")
