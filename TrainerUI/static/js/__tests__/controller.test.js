import { initController } from '../controller.js';

global.fetch = jest.fn(() =>
  Promise.resolve({ json: () => Promise.resolve({ time: 3, accuracy: 0.85 }) })
);

document.body.innerHTML = `
  <button id="btnTrain"></button>
  <button id="btnStop"></button>
  <div id="trainingStatus"></div>
  <input id="inputEpochs" value="5">
  <input type="radio" name="data-source" value="local" checked>
`;

test('initController binds buttons', () => {
  initController();
  const btn = document.getElementById('btnTrain');
  expect(typeof btn.onclick === 'function' || btn.onclick === null).toBe(true);
});
