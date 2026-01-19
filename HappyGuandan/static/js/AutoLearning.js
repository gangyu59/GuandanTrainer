// 完全保持您第一次看到的原始类名和结构
function AutoLearning() {
  this.cycleCount = 0;
  this.isRunning = false;
  this.gameWindow = null;
}

// 启动自动循环（改用传统函数写法）
AutoLearning.prototype.start = function() {
  if (this.isRunning) return;

  this.isRunning = true;
  console.log('🚀 自动循环启动');

  var self = this;
  this.gameWindow = window.open('/HappyGuandan/index.html', '_blank');

  setTimeout(function() {
    self.gameWindow.postMessage({
      type: 'AUTO_LEARNING_SETUP',
      config: {
        autoPlay: true,
        machineLearning: true
      }
    }, '*');
  }, 3000);

  window.addEventListener('message', function(event) {
    self.handleMessage(event);
  });
};

// 消息处理（保持原有逻辑）
AutoLearning.prototype.handleMessage = function(event) {
  if (event.data.type === 'GAME_ENDED') {
    this.handleGameEnd(event.data.payload);
  }
};

// 游戏结束处理（改用传统异步写法）
AutoLearning.prototype.handleGameEnd = function(data) {
  var self = this;
  this.cycleCount++;

  window.parent.postMessage({
    type: 'CYCLE_UPDATE',
    count: this.cycleCount
  }, '*');

  if (this.cycleCount % 5 === 0) {
    this.triggerTraining().then(function() {
      self.continueGame();
    });
  } else {
    this.continueGame();
  }
};

// 继续游戏
AutoLearning.prototype.continueGame = function() {
  this.gameWindow.postMessage({
    type: 'RESTART_GAME'
  }, '*');
};

// 触发训练（改用传统Promise写法）
AutoLearning.prototype.triggerTraining = function() {
  return new Promise(function(resolve, reject) {
    fetch('/api/auto-train', { method: 'POST' })
      .then(function(response) {
        return response.json();
      })
      .then(function(data) {
        console.log('训练触发结果:', data);
        resolve();
      })
      .catch(function(err) {
        console.error('触发训练失败:', err);
        reject(err);
      });
  });
};

// 停止方法（保持不变）
AutoLearning.prototype.stop = function() {
  this.isRunning = false;
  if (this.gameWindow) this.gameWindow.close();
  window.removeEventListener('message', this.handleMessage);
};

// 全局挂载（保持原始方式）
window.autoLearner = new AutoLearning();