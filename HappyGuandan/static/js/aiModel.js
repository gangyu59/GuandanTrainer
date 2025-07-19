window.aiModel = {
  weights: null,

  async loadModel() {
    const res = await fetch('assets/ai/model_weights.json');
    this.weights = await res.json();
  },

  predict(stateVec) {
    if (!this.weights) return [];

    function linear(input, weights, bias) {
      return weights.map((wRow, i) =>
        wRow.reduce((sum, w, j) => sum + w * input[j], bias[i])
      );
    }

    function relu(arr) {
      return arr.map(v => Math.max(0, v));
    }

    function sigmoid(arr) {
      return arr.map(v => 1 / (1 + Math.exp(-v)));
    }

    const w = this.weights;
    let x = relu(linear(stateVec, w.layer0_weight, w.layer0_bias));
    let y = sigmoid(linear(x, w.layer2_weight, w.layer2_bias));
    return y; // 54维向量，每张牌对应一个概率
  }
};