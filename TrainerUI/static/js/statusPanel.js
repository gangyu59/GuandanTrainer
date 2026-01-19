// TrainerUI/static/js/statusPanel.js
export function updateStatus(msg) {
  const el = document.getElementById('statusOutput');
  if (el) el.textContent = msg;
}

export function setTraining(isTraining) {
  const btnTrain = document.getElementById('startBtn');  // ✅ 对应 HTML
  const btnStop = document.getElementById('stopBtn');    // ✅ 对应 HTML
  if (btnTrain) btnTrain.disabled = isTraining;
  if (btnStop) btnStop.disabled = !isTraining;
}



export function setProgress(percent) {
  const bar = document.getElementById("progressBar");
  bar.style.width = `${percent}%`;
  bar.innerText = `${percent}%`;
}



export function appendToStatus(msg) {
  const el = document.getElementById('statusOutput');
  if (el) {
    el.value += msg + '\n';
    el.scrollTop = el.scrollHeight;
  }
}

