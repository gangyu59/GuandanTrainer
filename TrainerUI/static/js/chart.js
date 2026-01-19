// === TrainerUI/static/js/chart.js ===

// 模块作用域内变量，避免全局污染
let lossChart = null;
let actionChart = null;
let metricsChart = null;

/**
 * 绘制 loss 曲线图
 * @param {string[]} logs - 日志数组，每行格式为 "Epoch X/Y - Loss: Z"
 */
export function updateLossChart(logs) {
  if (!lossChart) {
    const ctx = document.getElementById('lossChart').getContext('2d');
    lossChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: [],
        datasets: [{
          label: 'Loss',
          data: [],
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        animation: false
      }
    });
  }

  lossChart.data.labels = [];
  lossChart.data.datasets[0].data = [];

  logs.forEach(line => {
    const match = line.match(/Epoch (\d+)\/\d+ - Loss: ([\d.]+)/);
    if (match) {
      const epoch = parseInt(match[1]);
      const loss = parseFloat(match[2]);
      lossChart.data.labels.push(epoch);
      lossChart.data.datasets[0].data.push(loss);
    }
  });

  lossChart.update();
}

/**
 * 绘制动作频率柱状图
 * @param {Object} actionDist - e.g. { "0": 5, "12": 9, "23": 1 }
 */
export function drawActionChart(actionDist) {
  const ctx = document.getElementById("chartCanvas").getContext("2d");
  const labels = Object.keys(actionDist);
  const values = Object.values(actionDist);

  if (actionChart) {
    actionChart.destroy();
  }

  actionChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: '动作频率分布',
        data: values
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
        title: {
          display: true,
          text: '动作索引分布图'
        }
      },
      scales: {
        x: { title: { display: true, text: '动作索引（0~53）' }},
        y: { title: { display: true, text: '频次' }}
      }
    }
  });
}

/**
 * 绘制训练指标图表（准确率、熵）
 * @param {number} accuracy - 准确率 (0~1)
 * @param {number} entropy - 策略熵
 * @param {number} winrate - 胜率 (0~1)
 */
export function updateMetricsChart(accuracy, entropy, winrate) {
  const ctx = document.getElementById('metricsChart').getContext('2d');

  if (!metricsChart) {
    metricsChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: ['准确率', '策略熵', '胜率'],
        datasets: [{
          label: '训练指标',
          data: [accuracy, entropy, winrate],
          backgroundColor: [
            'rgba(54, 162, 235, 0.6)', // 准确率-蓝色
            'rgba(255, 159, 64, 0.6)',  // 熵-橙色
            'rgba(75, 192, 192, 0.6)'   // 胜率-绿色
          ],
          borderColor: [
            'rgba(54, 162, 235, 1)',
            'rgba(255, 159, 64, 1)',
            'rgba(75, 192, 192, 1)'
          ],
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        scales: {
          y: {
            beginAtZero: true,
            max: 1.2,
            ticks: {
              callback: function(value) {
                return value.toFixed(2);
              }
            }
          }
        },
        plugins: {
          tooltip: {
            callbacks: {
              label: function(context) {
                let label = context.dataset.label || '';
                if (label) label += ': ';
                if (context.parsed.y !== null) {
                  label += context.parsed.y.toFixed(4);
                }
                return label;
              }
            }
          }
        }
      }
    });
  } else {
    metricsChart.data.datasets[0].data = [accuracy, entropy, winrate];
    metricsChart.update();
  }
}
