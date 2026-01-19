// TrainerUI/static/js/controller.js

import { getConfig } from './config.js';
import { updateStatus, setTraining } from './statusPanel.js';
import { fetchJSON } from './utils.js';

// 全局状态
let isTraining = false;
let gameWindow = null;
let isAutoLearningActive = false;
let retryCount = 0;
const MAX_RETRY = 5;
const GAME_WINDOW_URL = '/HappyGuandan/index.html';
let statusCheckInterval = null;
let windowCheckInterval = null;

// ================= 核心训练函数 =================
export async function startTraining() {
  if (isTraining) return;

  const config = getConfig();
  isTraining = true;
  setTraining(true);
  updateStatus('训练已开始...');

  try {
    const res = await fetch('/api/train', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    });
    const result = await res.json();
    updateStatus(`✅ 训练完成，耗时 ${result.time}s，准确率 ${result.accuracy}`);
  } catch (err) {
    updateStatus('❌ 训练失败: ' + err.message);
  } finally {
    isTraining = false;
    setTraining(false);
  }
}

export async function stopTraining() {
  try {
    await fetch('/api/stop', { method: 'POST' });
    updateStatus('⏹️ 已请求停止训练');
  } catch (e) {
    updateStatus('❌ 停止失败: ' + e.message);
  }
}

export async function checkStatus() {
  try {
    const data = await fetchJSON('/api/status');
    if (data.status) updateStatus(data.status);
  } catch (err) {
    console.error('状态检查失败:', err);
  }
}

// ================= 自动学习功能 =================
function startAutoLearningCycle(button) {
  console.log('▶ 启动自动循环');
  button.textContent = '停止循环';
  isAutoLearningActive = true;
  updateStatus('正在启动游戏窗口...');
  retryCount = 0;

  // 关闭可能存在的旧窗口
  if (gameWindow && !gameWindow.closed) {
    gameWindow.close();
  }

  // 打开新窗口
  gameWindow = window.open(
    GAME_WINDOW_URL,
    'happyGuandanWindow',
    'width=1200,height=800,top=100,left=100'
  );

  if (!gameWindow) {
    handleWindowOpenFail(button);
    return;
  }

  // 设置窗口监控
  setupWindowMonitoring(button);
}

function stopAutoLearningCycle(button) {
  console.log('■ 停止自动循环');
  button.textContent = '自动循环';
  isAutoLearningActive = false;
  updateStatus('自动循环已停止');

  // 清理所有间隔
  if (statusCheckInterval) clearInterval(statusCheckInterval);
  if (windowCheckInterval) clearInterval(windowCheckInterval);

  // 关闭游戏窗口
  if (gameWindow && !gameWindow.closed) {
    gameWindow.close();
  }
  gameWindow = null;

  // 移除事件监听
  window.removeEventListener('message', handleGameWindowMessage);
}

function handleAutoLearningClick() {
  const button = this;
  try {
    if (!isAutoLearningActive) {
      startAutoLearningCycle(button);
    } else {
      stopAutoLearningCycle(button);
    }
  } catch (err) {
    console.error('自动循环处理异常:', err);
    updateStatus(`❌ 自动循环错误: ${err.message}`);
    button.textContent = '自动循环';
    isAutoLearningActive = false;
  }
}

function setupWindowMonitoring(button) {
  windowCheckInterval = setInterval(() => {
    if (!gameWindow || gameWindow.closed) {
      clearInterval(windowCheckInterval);
      handleWindowClose(button);
    } else {
      window.addEventListener('message', handleGameWindowMessage);
    }
  }, 100);
}

function handleWindowOpenFail(button) {
  console.warn('窗口打开失败');
  updateStatus('❌ 请允许弹窗以继续');
  const allowPopups = confirm('游戏窗口被阻止，请允许弹窗后点击"确定"重试');

  if (allowPopups) {
    gameWindow = window.open(
      GAME_WINDOW_URL,
      'happyGuandanWindow',
      'width=1200,height=800'
    );
    if (gameWindow) {
      setupWindowMonitoring(button);
    } else {
      handleWindowClose(button);
    }
  } else {
    handleWindowClose(button);
  }
}

function handleGameWindowMessage(event) {
  if (event.origin !== window.location.origin) return;

  console.log('收到游戏消息:', event.data);

  if (event.data.type === 'GAME_READY') {
    console.log('游戏已准备就绪');
    updateStatus('正在配置游戏设置...');
    setupAutoLearning();
  }
}


function setupAutoLearning() {
  if (!gameWindow) return;

  // 发送自动开始指令
  const sendCommand = () => {
    gameWindow.postMessage({
      type: 'START_AUTO_PLAY',
      config: {
        autoPlay: true,
        machineLearning: true
      }
    }, window.location.origin);

    console.log('[Controller] 已发送自动开始指令');
  };

  // 首次发送
  sendCommand();

  // 每3秒确认一次状态（防止消息丢失）
  const confirmInterval = setInterval(() => {
    if (!gameWindow.closed) {
      sendCommand();
    } else {
      clearInterval(confirmInterval);
    }
  }, 3000);
}


function handleWindowClose(button) {
  if (button) button.textContent = '自动循环';
  isAutoLearningActive = false;
  updateStatus('游戏窗口已关闭');
  gameWindow = null;
}

// ================= 数据管理函数 =================
export async function refreshDataCount() {
  try {
    const response = await fetch('http://127.0.0.1:8000/api/count', {
      cache: 'no-store'
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const json = await response.json();
    const countEl = document.getElementById('dataCount');
    if (countEl && json.count !== undefined) {
      countEl.textContent = `当前数据库样本数：${json.count}`;
    }
  } catch (err) {
    console.error('获取记录数失败', err);
    setTimeout(refreshDataCount, 5000);
  }
}

export async function loadModelWeights() {
  try {
    const res = await fetch('../../output/model_weights.json');
    return await res.json();
  } catch (err) {
    console.error('加载模型参数失败:', err);
    throw err;
  }
}

// ================= 初始化函数 =================
function initializeAutoLearningButton() {
  const autoLearningBtn = document.getElementById('autoLearningBtn');
  if (!autoLearningBtn) return;

  const newBtn = autoLearningBtn.cloneNode(true);
  autoLearningBtn.parentNode.replaceChild(newBtn, autoLearningBtn);
  newBtn.addEventListener('click', handleAutoLearningClick);
}



// 常量定义（永不更改）
const TRAINING_INTERVAL = 5 * 60 * 1000; // 5分钟
const TRAINING_DURATION = 30 * 1000;    // 30秒
const INITIAL_DELAY = 10000;            // 10秒初始延迟

export function initController() {
  // 永久绑定按钮ID
  document.getElementById('startBtn')?.addEventListener('click', startTraining);
  document.getElementById('stopBtn')?.addEventListener('click', stopTraining);
  document.getElementById('launchGameBtn')?.addEventListener('click', launchGame);

  initializeAutoLearningButton();
  setInterval(checkStatus, 3000);
  refreshDataCount();

  // 安全启动定时训练
  safelyStartTrainingTimer();
}

// 安全启动训练（新增页面加载检测）
function safelyStartTrainingTimer() {
  if (document.readyState === 'complete') {
    delayedTrainingStart();
  } else {
    window.addEventListener('load', () => {
      delayedTrainingStart();
    });
  }
}

// 延迟启动训练（新增10秒延迟）
function delayedTrainingStart() {
  console.log('页面已完全加载，等待10秒后启动训练...');

  setTimeout(() => {
    console.log('正式启动定时训练');
    setupTrainingTimer();
  }, INITIAL_DELAY);
}

// 永久不变的定时训练设置
function setupTrainingTimer() {
  console.log('初始化定时训练');

  // 立即执行第一次（带10秒延迟）
  setTimeout(runTrainingCycle, INITIAL_DELAY);

  // 设置周期定时器
  const trainingTimer = setInterval(runTrainingCycle, TRAINING_INTERVAL);

  window.addEventListener('beforeunload', () => {
    clearInterval(trainingTimer);
  });
}

// 永久不变的训练周期执行
function runTrainingCycle() {
  console.log('--- 开始训练周期 ---');

  const startBtn = document.getElementById('startBtn');
  if (!startBtn) {
    console.error('错误：startBtn不存在');
    return;
  }

  console.log('点击开始训练');
  startBtn.click();

  setTimeout(() => {
    const stopBtn = document.getElementById('stopBtn');
    if (stopBtn) {
      console.log('点击停止训练');
      stopBtn.click();
    }
  }, TRAINING_DURATION);
}

// 永久不变的辅助函数
function launchGame() {
  window.open(GAME_WINDOW_URL, 'happyGuandanWindow');
}


// 主入口
document.addEventListener('DOMContentLoaded', initController);