import subprocess
import os


def run_self_play(rounds=10, js_path="TrainerUI/static/js/simulate.js"):
    try:
        if not os.path.exists(js_path):
            print(f"❌ JS 文件不存在: {js_path}")
            return False

        result = subprocess.run(["node", js_path, str(rounds)], capture_output=True, text=True)
        if result.returncode == 0:
            print(f"✅ 自博弈完成，共 {rounds} 局")
            return True
        else:
            print(f"❌ 自博弈失败: {result.stderr}")
            return False
    except Exception as e:
        print(f"❌ 执行自博弈出错: {e}")
        return False
