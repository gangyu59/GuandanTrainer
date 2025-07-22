import { postJSON } from '../utils.js';

global.fetch = jest.fn(() =>
  Promise.resolve({
    json: () => Promise.resolve({ success: true })
  })
);

test('postJSON sends POST and returns response', async () => {
  const response = await postJSON('/api/train', { test: 1 });
  expect(fetch).toHaveBeenCalledWith('/api/train', expect.objectContaining({
    method: 'POST'
  }));
  expect(response.success).toBe(true);
});
