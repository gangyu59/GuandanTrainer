import { getConfig } from '../config.js';
document.body.innerHTML = `
  <input type="radio" name="data-source" value="local" checked>
  <input id="inputEpochs" value="20">
`;

test('getConfig returns selected config', () => {
  const config = getConfig();
  expect(config.dataSource).toBe('local');
  expect(config.epochs).toBe(20);
});
