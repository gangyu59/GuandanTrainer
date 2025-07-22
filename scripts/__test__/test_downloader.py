import unittest
from unittest.mock import patch, MagicMock
import json
import sqlite3
import os

from scripts import downloader


class TestDownloader(unittest.TestCase):

    @patch('scripts.downloader.requests.get')
    def test_download_from_firebase_success(self, mock_get):
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "game1": [{"state": [1], "action": [2]}],
            "game2": [{"state": [3], "action": [4]}]
        }
        mock_get.return_value = mock_response

        data = downloader.download_from_firebase()
        self.assertEqual(len(data), 2)
        self.assertEqual(data[0]['state'], [1])
        self.assertEqual(data[1]['action'], [4])

    @patch('scripts.downloader.requests.get')
    def test_download_from_firebase_failure(self, mock_get):
        mock_get.side_effect = Exception("Network error")
        data = downloader.download_from_firebase()
        self.assertEqual(data, [])

    def test_load_from_sqlite_success(self):
        # 构建测试数据库
        test_db = 'test_game_data.sqlite'
        conn = sqlite3.connect(test_db)
        cur = conn.cursor()
        cur.execute("CREATE TABLE game_records (state TEXT, action TEXT, meta TEXT)")
        cur.execute(
            "INSERT INTO game_records VALUES (?, ?, ?)",
            (json.dumps([1, 2]), json.dumps([3, 4]), json.dumps({"win": True}))
        )
        conn.commit()
        conn.close()

        result = downloader.load_from_sqlite(db_path=test_db)
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]['state'], [1, 2])
        self.assertEqual(result[0]['action'], [3, 4])
        self.assertTrue(result[0]['meta']['win'])

        os.remove(test_db)

    def test_load_data_invalid_source(self):
        with self.assertRaises(ValueError):
            downloader.load_data(source='invalid')


if __name__ == '__main__':
    unittest.main()
