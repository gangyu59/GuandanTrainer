# === scripts/main.py ===
from downloader import load_data
from processor import clean_dataset, parse_dataset, analyze_meta
from trainer import train_model
from export import export_weights


if __name__ == '__main__':
    # ✅ 选择数据源：local / firebase
    source = 'local'  # 或 'firebase'

    raw_data = load_data(source)
    cleaned_data = clean_dataset(raw_data)
    X, y, meta = parse_dataset(cleaned_data)

    analyze_meta(meta, y)
    print(f"\n🎯 开始训练：X={X.shape}, y={y.shape}\n")

    model = train_model(X, y, epochs=50)
    export_weights(model)
