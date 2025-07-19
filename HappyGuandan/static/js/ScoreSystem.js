window.ScoreSystem = function () {
  // 内部等级状态
  let levels = {
    self: 2,
    opponent: 2
  };

  // ⚠️ 记录上一盘胜方（决定主牌归属）
  let lastWinnerTeam = 'self';

  // 🔄 重置等级为 2
  this.reset = function () {
    levels.self = 2;
    levels.opponent = 2;
    lastWinnerTeam = 'self';
    updateDOM();
  };

  // 🧾 获取当前等级
  this.getScores = function () {
    return { ...levels }; // 返回副本防止外部修改
  };

  // ✅ 设置等级
  this.setScores = function (self, opponent) {
    levels.self = self;
    levels.opponent = opponent;
    updateDOM();
  };

  // ⬆️ 增加某一方等级
  this.incrementScore = function (team, delta) {
    if (!['self', 'opponent'].includes(team)) return;
    levels[team] += delta;
    updateDOM();
  };

  // 🌟 高亮胜方队伍
  this.highlightTeam = function (team) {
    document.querySelectorAll('#scoreboard .team').forEach(div => {
      div.classList.remove('highlight');
    });
    document.querySelector(`#scoreboard .${team}`)?.classList.add('highlight');
  };

  // 🧠 计算晋级等级（结束一盘后调用）
  this.calculateLevelUp = function (finalOrder) {
    if (!Array.isArray(finalOrder) || finalOrder.length !== 4) return;

    const [first, , third, fourth] = finalOrder;
    const selfTeam = [0, 2];
    const opponentTeam = [1, 3];

    const isSelfTeamWin = selfTeam.includes(first);
    const winnerTeam = isSelfTeamWin ? 'self' : 'opponent';

    const partner = (first + 2) % 4;
    const partnerRank = finalOrder.indexOf(partner);

    let levelGain = 1;
    if (partnerRank === 2) levelGain = 2;
    else if (partnerRank === 1) levelGain = 3;

    console.log(`🏆 胜方：${winnerTeam} 队，晋级：+${levelGain} 级`);

    this.incrementScore(winnerTeam, levelGain);
    this.highlightTeam(winnerTeam);

    // ✅ 记录胜方队伍用于下一盘设定主牌
    lastWinnerTeam = winnerTeam;
  };

  // 🎴 获取下一盘主牌的决定依据
  this.getTrumpInfo = function () {
    if (window.firstPlayerIndex === null) {
      // 第一盘默认用己方的等级为主牌
      return { team: 'self', level: levels.self };
    }

    // 否则根据上一盘的胜方来决定主牌
    const level = levels[lastWinnerTeam];
    return { team: lastWinnerTeam, level };
  };

  // 🏁 判断是否整局胜利（超过 A）
  this.checkGlobalWin = function () {
    const { self, opponent } = this.getScores();
    if (self > 14) return 'self';
    if (opponent > 14) return 'opponent';
    return null;
  };

  // 🖥️ 刷新 UI
  function updateDOM() {
    document.getElementById('self-score').textContent = levels.self;
    document.getElementById('opponent-score').textContent = levels.opponent;
  }
};