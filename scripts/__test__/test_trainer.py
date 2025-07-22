import unittest
import numpy as np
import torch
from scripts import trainer


class TestTrainer(unittest.TestCase):

    def setUp(self):
        # 构造一个小的训练数据集：3 个样本，输入 288 维，输出 54 维
        self.X = np.random.rand(3, 288).astype(np.float32)
        self.y = np.random.randint(0, 2, size=(3, 54)).astype(np.float32)

    def test_train_model_returns_model(self):
        model = trainer.train_model(self.X, self.y, epochs=2)
        self.assertIsInstance(model, torch.nn.Module)

    def test_model_output_shape(self):
        model = trainer.train_model(self.X, self.y, epochs=1)
        input_tensor = torch.tensor(self.X, dtype=torch.float32)
        output = model(input_tensor)
        self.assertEqual(output.shape, torch.Size([3, 54]))


if __name__ == '__main__':
    unittest.main()
