# === main.py ===
from data.downloader import download_data, clear_firebase
from data.processor import parse_dataset, analyze_meta, clean_dataset
from model.trainer import train_model
from model.export import export_weights

if __name__ == '__main__':
    # clear_firebase()  # ✅ 只运行一次，然后注释掉
    raw_data = download_data()
    # ✅ 清洗
    cleaned_data = clean_dataset(raw_data)
    X, y, meta = parse_dataset(cleaned_data)
    print("meta数据：",meta[0])

    # 🔍 胜率分析
    analyze_meta(meta)

    print(f"🎯 准备开始训练：X={X.shape}, y={y.shape}")

    model = train_model(X, y, epochs=20)
    export_weights(model)
