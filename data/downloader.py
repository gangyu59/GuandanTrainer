# === data/downloader.py ===
import requests
from config.firebase_config import FIREBASE_URL

def download_data():
    try:
        response = requests.get(FIREBASE_URL)
        if response.status_code != 200:
            print(f"❌ 请求失败: {response.status_code}")
            return []

        raw = response.json()
        if not raw:
            print("⚠️ Firebase 数据为空")
            return []

        all_entries = []
        for key, round_data in raw.items():  # 每个 key 是一盘
            if isinstance(round_data, list):
                print(f"📦 Round {key} 包含 {len(round_data)} 条样本")
                all_entries.extend(round_data)
            else:
                print(f"⚠️ 键 {key} 的值不是列表，跳过")

        print(f"✅ 下载完成，共 {len(all_entries)} 条训练数据")
        return all_entries

    except Exception as e:
        print(f"❌ 下载出错: {e}")
        return []


# 一次性使用清理云数据，需谨慎使用
def clear_firebase():
    try:
        response = requests.delete(FIREBASE_URL)
        if response.status_code == 200:
            print("🧹 成功清空 Firebase 训练数据")
        else:
            print(f"⚠️ 清空失败: 状态码 {response.status_code}")
    except Exception as e:
        print(f"❌ 清空出错: {e}")


def is_valid_sample(sample):
    try:
        if 'state' not in sample or 'action' not in sample:
            print("❌ 缺失 state 或 action")
            return False
        if not isinstance(sample['state'], list) or not isinstance(sample['action'], list):
            print("❌ 类型错误:", sample)
            return False
        if len(sample['state']) < 50:
            print("❌ state 太短")
            return False
        if len(sample['action']) < 1:
            print("❌ action 太短")
            return False
        return True
    except Exception as e:
        print("❌ 异常:", e)
        return False

