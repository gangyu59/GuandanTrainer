# === scripts/export.py ===
import torch
import json
import numpy as np
import os

def export_weights00(model, filepath='output/model_weights.json'):
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

    def export_weights(model, filepath='HappyGuandan/assets/ai/model_weights.json'):
        """严格保持原有权重格式的导出函数"""

        def round_floats(obj):
            if isinstance(obj, float):
                return round(obj, 6)
            elif isinstance(obj, list):
                return [round_floats(x) for x in obj]
            return obj

        # 获取模型权重（保持原有层级命名）
        state_dict = model.state_dict()

        # 转换为前端需要的固定格式
        weights = {
            "W2": round_floats(state_dict['layer2.weight'].T.tolist()),  # 注意转置
            "b2": round_floats(state_dict['layer2.bias'].tolist())
        }

        # 直接写入指定路径（不检查目录）
        with open(filepath, 'w') as f:
            json.dump(weights, f, separators=(',', ':'))

        print(f"✅ 权重已导出到 {filepath}")
        print(f"W2 维度: {len(weights['W2'])}x{len(weights['W2'][0])}")
        print(f"b2 长度: {len(weights['b2'])}")


def export_weights(model, filepath):
    """专为SimpleMLP设计的权重导出函数"""
    try:
        print(f"🔄 开始导出权重到: {os.path.abspath(filepath)}")

        # 1. 验证模型
        if model is None:
            raise ValueError("模型对象为None")

        state_dict = model.state_dict()
        print(f"模型参数键: {list(state_dict.keys())}")  # 应输出: ['model.layer0.weight', 'model.layer0.bias', ...]

        # 2. 精确匹配您的模型结构
        weights = {
            "layer0_weight": state_dict['model.layer0.weight'].cpu().numpy().tolist(),
            "layer0_bias": state_dict['model.layer0.bias'].cpu().numpy().tolist(),
            "hidden_weight": state_dict['model.hidden.weight'].cpu().numpy().tolist(),
            "hidden_bias": state_dict['model.hidden.bias'].cpu().numpy().tolist(),
            "layer2_weight": state_dict['model.layer2.weight'].cpu().numpy().tolist(),
            "layer2_bias": state_dict['model.layer2.bias'].cpu().numpy().tolist()
        }

        # 3. 创建目录（如果不存在）
        os.makedirs(os.path.dirname(filepath), exist_ok=True)

        # 4. 原子写入
        temp_path = filepath + '.tmp'
        with open(temp_path, 'w', encoding='utf-8') as f:
            json.dump(weights, f, indent=2)

        os.replace(temp_path, filepath)

        # 5. 验证导出
        assert os.path.exists(filepath), "最终文件未生成"
        print(f"✅ 权重成功导出！文件大小: {os.path.getsize(filepath) / 1024:.2f} KB")
        return True

    except KeyError as e:
        print(f"❌ 键值错误: {str(e)}\n当前模型参数键: {list(state_dict.keys())}")
        raise
    except Exception as e:
        print(f"❌ 导出失败: {str(e)}")
        raise