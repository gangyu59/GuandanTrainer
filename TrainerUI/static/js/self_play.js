const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();
const { runSelfPlayGame } = require('./HappyGuandan/core/self_play_runner'); // 假设你已有此模块

// ✅ 打开数据库
const db = new sqlite3.Database('db/game_data.sqlite');

// ✅ 启动一次自博弈并写入数据库
async function playAndStore() {
  const samples = await runSelfPlayGame(); // 返回格式：[{state, action, meta}, ...]

  db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS game_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      state TEXT,
      action TEXT,
      meta TEXT
    )`);

    const stmt = db.prepare(`INSERT INTO game_records (state, action, meta) VALUES (?, ?, ?)`);

    for (const entry of samples) {
      stmt.run(
        JSON.stringify(entry.state),
        JSON.stringify(entry.action),
        JSON.stringify(entry.meta || {})
      );
    }

    stmt.finalize(() => {
      console.log(`✅ 成功写入 ${samples.length} 条自博弈数据`);
      db.close();
    });
  });
}

playAndStore();
