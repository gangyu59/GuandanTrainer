/**
 * @jest-environment jsdom
 */

import { updateStatus, setTraining } from '../statusPanel.js';

describe('statusPanel', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="trainingStatus"></div>
      <button id="startBtn"></button>
      <button id="btnTrain"></button>
      <button id="btnStop"></button>
    `;
  });

  test('updateStatus sets status text', () => {
    updateStatus('测试中...');
    const statusBar = document.getElementById('trainingStatus');
    expect(statusBar.textContent).toBe('测试中...');
  });

  test('setTraining(true) disables buttons', () => {
    setTraining(true);
    expect(document.getElementById('btnTrain').disabled).toBe(true);
    expect(document.getElementById('btnStop').disabled).toBe(false); // btnStop 应该启用
  });

  test('setTraining(false) enables buttons', () => {
    setTraining(true); // 先置 true 再还原
    setTraining(false);
    expect(document.getElementById('btnTrain').disabled).toBe(false);
    expect(document.getElementById('btnStop').disabled).toBe(true); // btnStop 应该禁用
  });
});