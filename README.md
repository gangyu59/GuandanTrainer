GuandanTrainer/
├── HappyGuandan/               # ✅ 原始 JS 游戏模块（不改名）
│   ├── index.html              # 游戏入口
│   ├── css/                    # 样式
│   ├── assets/                 # 图片/音效/牌面等资源
│   └── static/
│       └── js/                 # 游戏核心逻辑：AI、规则、界面
│           ├── AIPlayer.js
│           ├── Card.js
│           ├── Deck.js
│           ├── Game.js
│           ├── GameRule.js
│           ├── CardRules.js
│           ├── CardPower.js
│           ├── PlayCard.js
│           ├── PartnerStrategy.js
│           ├── HandOptimizer.js
│           ├── CardSelector.js
│           ├── CanvasManager.js
│           ├── OverlayRender.js
│           ├── ScoreSystem.js
│           ├── DataLogger.js            # ✅ 写入本地 SQLite
│           ├── ModelRunner.js           # ✅ 使用训练模型
│           ├── Trainer.js               # ✅ JS 调用训练（如果有）
│           ├── utils.js
│           └── main.js
│
├── TrainerUI/                 # ✅ 控制训练过程的前端界面
│   ├── index.html             # 控制台页面（启动/暂停/数据源选择等）
│   ├── css/
│   ├── assets/
│   └── static/
│       └── js/
│           ├── controller.js            # 启动训练流程
│           ├── statusPanel.js           # 状态进度条显示
│           ├── config.js                # 数据源选择、参数设定
│           └── utils.js
│
├── db/
│   └── game_data.sqlite       # 本地游戏数据存储
│
├── output/
│   └── model_weights.json     # ✅ 导出的模型参数供 JS 使用
│
├── scripts/                   # ✅ 所有 Python 脚本集中放在这里
│   ├── main.py                # 总控入口
│   ├── downloader.py          # 从 Firebase 下载数据
│   ├── processor.py           # 清洗并解析数据
│   ├── trainer.py             # 模型训练逻辑
│   ├── export.py              # 导出模型参数
│   ├── simple_mlp.py          # PyTorch MLP 模型定义
│   ├── firebase_config.py     # Firebase API 配置
│   ├── self_play_runner.py    # 调用 JS 模拟游戏对局
│   ├── evaluate.py            # 模型效果评估和对比
│   ├── logger.py              # 通用日志模块
│   └── test_*.py              # ✅ 单元测试文件（按模块命名）
│
├── requirements.txt
└── README.md                  # 项目说明文档

# Release Notes

## v3.0 (Latest)
- **Strategy Upgrade**: Replaced LLM with AlphaGo-style **MCTS (Monte Carlo Tree Search)** as the primary decision engine.
  - Implements team-aware heuristics (no friendly fire, passing support).
  - Uses rollout simulations to estimate win rates.
- **New Dashboard**: Added a draggable "Training Stats & Decision Comparison" dashboard.
  - **Live Comparison**: Shows MCTS decision vs LLM recommendation side-by-side.
  - **Metrics**: Displays estimated Win Rate, Visit Counts, and Hand Strength Score.
  - **Visualization**: Real-time charts for Win Rate and Hand Score trends.
- **UI Improvements**: 
  - Independent draggable windows for AI Reasoning and Dashboard.
  - Enhanced text visibility and layout.
- **Hand Strength Evaluation**: Added quantitative scoring for hand quality (bombs, card values).

## v2.6
- **AI Backend Migration**: Moved AI decision logic to Python backend (`GuandanAgent/engine`).
- **LLM Integration**: Integrated ARK/DouBao LLM for strategic decision making via hybrid architecture.
- **Visual AI Reasoning**: Added "AI推理和推荐" (AI Reasoning & Suggestion) modal to frontend.
  - Displays real-time AI thought process in Chinese.
  - Maintains scrollable history of AI reasoning.
  - **Smart Highlighting**: Automatically highlights AI-recommended cards in non-autopilot mode for one-click play.
- **Card Type Support**: 
  - Single, Pair, Triple, Full House (3+2), Bomb.
  - (In Progress) Straight, Steel Plate, Wooden Board, Straight Flush.
- **Performance**: Removed artificial delays for faster gameplay.

## v2.5
- Initial Backend API implementation.
- Basic rule-based AI in Python.

目标：

- 在 PC 上用 PyCharm 下载 Firebase 数据并训练模型;
- 训练后权重保存为 `output/weights.json`;
- 将该文件传回 iPhone 项目（通过 AirDrop / iCloud / Textastic）;
- HappyGuandan 前端加载权重并使用 decideByML 决策，供 AIPlayer 使用；
- 用 UI 中的“机器学习”复选框启用。
