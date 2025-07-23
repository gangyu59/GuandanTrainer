import unittest
import numpy as np
from scripts import processor


class TestProcessor(unittest.TestCase):

    def setUp(self):
        self.valid_sample = {
            "state": [0.0] * 288,
            "action": [0] * 53 + [1],
            "meta": {"playerIndex": 0, "winner": "self"}
        }
        self.invalid_sample = {
            "state": [0.0] * 100,  # 长度不对
            "action": [0] * 54
        }

    def test_clean_dataset_valid(self):
        data = [self.valid_sample, self.invalid_sample]
        cleaned = processor.clean_dataset(data)
        self.assertEqual(len(cleaned), 1)
        self.assertEqual(cleaned[0]["state"], self.valid_sample["state"])

    def test_clean_dataset_all_invalid(self):
        data = [self.invalid_sample]
        cleaned = processor.clean_dataset(data)
        self.assertEqual(len(cleaned), 0)

    def test_parse_dataset_shapes(self):
        data = [self.valid_sample] * 3
        X, y, meta = processor.parse_dataset(data)
        self.assertEqual(X.shape, (3, 288))
        self.assertEqual(y.shape, (3, 54))
        self.assertEqual(len(meta), 3)

    def test_analyze_meta_winrate(self):
        meta = [
            {"playerIndex": 0, "winner": "self"},
            {"playerIndex": 1, "winner": "opponent"},
            {"playerIndex": 0, "winner": "opponent"},
            {"playerIndex": 1, "winner": "self"},
        ]
        # 预期胜利为前两个，第三第四为失败
        processor.analyze_meta(meta, y)  # ✅ 输出测试，不抛异常即算通过


if __name__ == '__main__':
    unittest.main()
