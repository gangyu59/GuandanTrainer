function DataLogger() {
  this.localKey = 'guandan_training_data';
  this.buffer = [];

  // 初始化已有本地数据
  this.loadLocalData = function () {
    const raw = localStorage.getItem(this.localKey);
    try {
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      console.warn('⚠️ 本地数据解析失败:', e);
      return [];
    }
  };

  this.saveLocalData = function () {
    const combined = this.loadLocalData().concat(this.buffer);
    localStorage.setItem(this.localKey, JSON.stringify(combined));
    this.buffer = [];
  };

  /**
   * 添加一条训练数据
   * @param {Array} stateVec 状态向量
   * @param {Array} actionVec 动作向量
   * @param {Object} meta 元信息，如出牌者、牌型等
   */
  this.record = function (stateVec, actionVec, meta = {}) {
    const entry = {
      state: stateVec,
      action: actionVec,
      meta,
      timestamp: Date.now()
    };
    this.buffer.push(entry);

    // 每累计10条数据自动保存一次
    if (this.buffer.length >= 10) {
      this.saveLocalData();
    }
  };



  /**
   * 上传所有数据到 Firebase（如果已配置）
   */
  this.uploadToFirebase = async function () {
	  const data = this.loadLocalData();
	  if (data.length === 0) {
	    console.warn('⚠️ 没有可上传的数据');
	    return;
	  }
	
	  try {
	    const firebaseURL = 'https://happyguandan-default-rtdb.asia-southeast1.firebasedatabase.app/training_data.json';
	
	    const res = await fetch(firebaseURL, {
	      method: 'POST',
	      body: JSON.stringify(data),
	      headers: { 'Content-Type': 'application/json' }
	    });
	
	    if (res.ok) {
	      console.log('✅ 成功上传训练数据到 Firebase');
	      localStorage.removeItem(this.localKey);
	    } else {
	      const text = await res.text();
	      console.warn('⚠️ 上传失败：', text);
	    }
	  } catch (e) {
	    console.error('❌ 上传出错：', e);
	  }
	};

  this.saveToSQLite = async function () {
      const data = this.loadLocalData();
      if (data.length === 0) {
        console.warn('⚠️ 没有可写入 SQLite 的数据');
        return;
      }

      try {
        const res = await fetch('/api/save_sqlite', {
          method: 'POST',
          body: JSON.stringify(data),
          headers: { 'Content-Type': 'application/json' }
        });

        if (res.ok) {
          console.log(`✅ 成功写入 SQLite，共 ${data.length} 条`);
          localStorage.removeItem(this.localKey);
        } else {
          const msg = await res.text();
          console.error('❌ 写入 SQLite 失败:', msg);
        }
      } catch (e) {
        console.error('❌ 写入 SQLite 出错:', e);
      }
    };
}

window.dataLogger = new DataLogger();