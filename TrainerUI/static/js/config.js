// TrainerUI/static/js/config.js
export function getConfig() {
  const dataSource = document.querySelector('input[name="data-source"]:checked')?.value || 'firebase';
  const epochs = parseInt(document.getElementById('inputEpochs')?.value || '50', 10);
  return { dataSource, epochs };
}
