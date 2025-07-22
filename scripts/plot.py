import matplotlib.pyplot as plt

def plot_training_history(history):
    plt.figure()
    plt.plot(history["train_loss"], label="Train Loss")
    plt.plot(history["val_loss"], label="Val Loss")
    plt.plot(history["top1_acc"], label="Top-1 Accuracy")
    plt.title("训练过程")
    plt.xlabel("Epoch")
    plt.ylabel("值")
    plt.legend()
    plt.grid(True)
    plt.tight_layout()
    plt.show()
