# === scripts/__test__/test_export.py ===
import unittest
import os
import json
import torch
import torch.nn as nn
from scripts import export


class DummyModel(nn.Module):
    def __init__(self):
        super().__init__()
        self.model = nn.Sequential(
            nn.Linear(10, 20),
            nn.ReLU(),
            nn.Linear(20, 3)
        )

    def forward(self, x):
        return self.model(x)


class TestExport(unittest.TestCase):
    def setUp(self):
        self.model = DummyModel()
        self.outfile = 'output/test_weights.json'
        # 确保输出目录存在
        os.makedirs('output', exist_ok=True)

    def tearDown(self):
        if os.path.exists(self.outfile):
            os.remove(self.outfile)

    def test_export_weights_creates_file(self):
        export.export_weights(self.model, self.outfile)
        self.assertTrue(os.path.exists(self.outfile), "导出文件未创建")

    def test_export_weights_content(self):
        export.export_weights(self.model, self.outfile)
        with open(self.outfile, 'r') as f:
            data = json.load(f)

        self.assertIn('W2', data)
        self.assertIn('b2', data)

        self.assertIsInstance(data['W2'], list)
        self.assertIsInstance(data['b2'], list)
        self.assertEqual(len(data['b2']), 3)
        self.assertEqual(len(data['W2'][0]), 20)


if __name__ == '__main__':
    unittest.main()
