GuandanTrainer/
├── config/
│   └── firebase_config.py        # 存储 Firebase API endpoint、密钥等配置
│
├── data/
│   ├── downloader.py             # 从 Firebase 下载数据
│   ├── processor.py              # 解析 state 和 action 向量
│   └── sample_data.json          # 本地缓存或示例数据
│
├── model/
│   ├── trainer.py                # 构建、训练模型
│   ├── export.py                 # 导出权重为 JSON 格式供 JS 使用
│   └── simple_mlp.py             # 简单的神经网络模型（用 PyTorch）
│
├── utils/
│   └── logger.py                 # 日志输出或通用工具
│
├── notebooks/
│   └── explore_data.ipynb        # 用于可视化或分析数据结构
│
├── output/
│   └── weights.json              # 导出的模型权重（JS 可读取）
│
├── main.py                       # 主入口：串联下载 → 训练 → 导出流程
├── requirements.txt              # 所需依赖库
└── README.md                     # 项目说明文档


目标：

- 在 PC 上用 PyCharm 下载 Firebase 数据并训练模型;
- 训练后权重保存为 `output/weights.json`;
- 将该文件传回 iPhone 项目（通过 AirDrop / iCloud / Textastic）;
- HappyGuandan 前端加载权重并使用 decideByML 决策，供 AIPlayer 使用；
- 用 UI 中的“机器学习”复选框启用。