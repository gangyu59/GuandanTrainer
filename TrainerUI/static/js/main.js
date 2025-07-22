import { getConfig } from './config.js';
import { updateStatus, setProgress, setTraining } from './statusPanel.js';
import { fetchJSON } from './utils.js';
import {refreshDataCount} from "./controller.js";

let trainingInProgress = false;

async function startTraining() {
  if (trainingInProgress) return;
  trainingInProgress = true;
  console.log("开始训练 ...");
  updateStatus('⏳ 启动训练中...');
  setTraining(true);

  const config = getConfig();

  try {
    const response = await fetch('/api/train', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    });

    if (!response.ok) throw new Error('训练请求失败');

    pollTrainingStatus();
  } catch (err) {
    console.error('❌ 启动失败:', err);
    updateStatus('❌ 启动失败：' + err.message);
    trainingInProgress = false;
    setTraining(false);
  }
}


function stopTraining() {
  trainingInProgress = false;
  updateStatus('🛑 已手动停止训练');
  setTraining(false);
}


async function pollTrainingStatus() {
  console.log("🔁 启动状态轮询");
  const interval = setInterval(async () => {
    try {
      const response = await fetch('http://127.0.0.1:8000/api/status');
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const result = await response.json();
      console.log("轮询结果:", result);

      // 新增：检查训练是否完成但页面未更新
      if (result.status === 'done' && trainingInProgress) {
        console.log("检测到训练完成但前端状态未更新");
        updateStatus('✅ 训练完成！');
        setProgress(100);
        refreshDataCount(); // 强制刷新数据计数
        clearInterval(interval);
        trainingInProgress = false;
        setTraining(false);
        return;
      }

      // 原有状态处理逻辑...
    } catch (err) {
      console.error('轮询出错:', err);
      // 特殊处理连接拒绝错误
      if (err.message.includes('Failed to fetch')) {
        updateStatus('⚠️ 后端服务连接异常，请检查服务是否运行');
      }
      clearInterval(interval);
      trainingInProgress = false;
      setTraining(false);
    }
  }, 1000);
  return interval;
}


window.addEventListener('DOMContentLoaded', () => {

  const btnStart = document.getElementById('startBtn');
  const btnStop = document.getElementById('stopBtn');

  if (btnStart) btnStart.addEventListener('click', startTraining);
  if (btnStop) btnStop.addEventListener('click', stopTraining);

  const btn = document.getElementById('launchGameBtn');
  if (btn) {
    btn.addEventListener('click', () => {
      // ✅ 正确路径（FastAPI 会映射这个）
      window.open('/HappyGuandan/index.html', '_blank');
    });
  }

    // ✅ 启动时刷新一次数据量
  refreshDataCount();

  // ✅ 每 5 秒刷新一次数据量
  setInterval(refreshDataCount, 10000);
});
