import { getConfig } from './config.js';
import { updateStatus, setProgress, setTraining, appendToStatus } from './statusPanel.js';
import { fetchJSON } from './utils.js';
import { refreshDataCount } from './controller.js';
import { updateLossChart, drawActionChart,} from "./chart.js";


let trainingInProgress = false;
let lastLogCount = 0;  // ✅ 记录上一次日志长度


async function startTraining() {
  if (trainingInProgress) return;
  trainingInProgress = true;
  console.log("开始训练 ...");
  updateStatus('⏳ 启动训练中...');
  setTraining(true);

  lastLogCount = 0; // ✅ 重置日志索引
  document.getElementById('statusOutput').value = ''; // ✅ 清空

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
  console.log('🔁 启动状态轮询');

  const interval = setInterval(async () => {
    try {
      const response = await fetch('http://127.0.0.1:8000/api/status');
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const result = await response.json();
      console.log('轮询结果:', result);

      // 更新 loss 图表
      if (result.logs && Array.isArray(result.logs)) {
        const newLogs = result.logs.slice(lastLogCount);
        newLogs.forEach(line => appendToStatus(line));
        lastLogCount = result.logs.length;
        updateLossChart(result.logs);
      }

      // 更新动作分布图
      if (result.metrics?.action_dist) {
        drawActionChart(result.metrics.action_dist);
      }

      // 新增：更新指标图表
      if (result.metrics) {
        updateMetricsChart(
          result.metrics.accuracy || 0,
          result.metrics.entropy || 0,
          result.metrics.winrate || 0
        );
      }

      // 显示文本指标
      if (result.metrics) {
        const metrics = result.metrics;
        const statusText = [
          `🏁 胜率: ${(metrics.winrate * 100).toFixed(2)}%`,
          `🎯 准确率: ${(metrics.accuracy * 100).toFixed(2)}%`,
          `📊 策略熵: ${metrics.entropy.toFixed(4)}`
        ].join(' | ');
        appendToStatus(statusText);
      }

      // 状态逻辑保持不变...
    } catch (err) {
      console.error('轮询出错:', err);
      updateStatus('⚠️ 后端服务连接异常，请检查服务是否运行');
      clearInterval(interval);
      setTraining(false);
      trainingInProgress = false;
    }
  }, 1000);
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
