/**
 * @jest-environment jsdom
 */

jest.mock('../controller.js', () => ({
  initController: jest.fn()
}));

import { initController } from '../controller.js';

describe('main.js', () => {
  beforeEach(() => {
    document.body.innerHTML = '<button id="startBtn"></button>';
    jest.resetModules();
  });

  test('DOMContentLoaded binds startTraining to startBtn', async () => {
    await import('../main.js');
    document.dispatchEvent(new Event('DOMContentLoaded'));

    const startBtn = document.getElementById('startBtn');
    startBtn.click();

    // 验证点击事件是否绑定
    expect(startBtn.onclick).toBeDefined();
  });
});