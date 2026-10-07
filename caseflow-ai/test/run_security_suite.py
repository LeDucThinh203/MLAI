"""
============================================================================
CASEFLOW AI - SECURITY SUITE RUNNER (PYTHON MODULE)
============================================================================
Khởi tạo máy chủ Backend Python FastAPI trên một cổng ngẫu nhiên trong môi trường
thư mục tạm biệt lập, chạy 40 tiêu chí kiểm thử bảo mật và dọn dẹp sạch sẽ.
============================================================================
"""

import os
import sys

if sys.stdout and hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
if sys.stderr and hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')

import time
import socket
import tempfile
import shutil
import secrets
import subprocess
import requests

project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
test_dir = os.path.join(project_root, 'test')
if project_root not in sys.path:
    sys.path.insert(0, project_root)
if test_dir not in sys.path:
    sys.path.insert(0, test_dir)


def find_available_port() -> int:
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.bind(('127.0.0.1', 0))
    port = s.getsockname()[1]
    s.close()
    return port


def wait_for_server(base_url: str, timeout: float = 30.0):
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            r = requests.get(f"{base_url}/api/health", timeout=1.0)
            if r.status_code == 200:
                return True
        except Exception:
            pass
        time.sleep(0.2)
    raise RuntimeError("Máy chủ Backend Python không sẵn sàng sau 30 giây.")


def main():
    data_dir = tempfile.mkdtemp(prefix="caseflow-security-test-py-")
    port = find_available_port()
    base_url = f"http://127.0.0.1:{port}"

    os.environ['NODE_ENV'] = 'test'
    os.environ['PORT'] = str(port)
    os.environ['DATA_DIR'] = data_dir
    os.environ['AI_MODE'] = 'mock'
    os.environ['GEMINI_API_KEY'] = ''
    os.environ['JWT_SECRET'] = secrets.token_hex(32)
    os.environ['REFRESH_SECRET'] = secrets.token_hex(32)
    os.environ['SIGNATURE_KEY'] = secrets.token_hex(32)
    os.environ['TEST_BASE_URL'] = base_url

    print(f"🚀 Khởi động Python Backend Engine tại: {base_url} (DATA_DIR: {data_dir})", flush=True)
    server_log_file = open(os.path.join(data_dir, 'server.log'), 'w', encoding='utf-8', errors='replace')
    server_process = subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "backend.server:app", "--port", str(port), "--host", "127.0.0.1"],
        cwd=project_root,
        env=os.environ.copy(),
        stdout=server_log_file,
        stderr=server_log_file
    )

    exit_code = 0
    try:
        wait_for_server(base_url)
        print("✅ Máy chủ Backend đã sẵn sàng! Bắt đầu chạy bộ kiểm thử...\n", flush=True)
        
        from security_and_system_test import run_security_test_suite
        run_security_test_suite()
    except Exception as e:
        print(f"❌ Lỗi trong quá trình kiểm thử: {e}", flush=True)
        server_log_file.flush()
        with open(os.path.join(data_dir, 'server.log'), 'r', encoding='utf-8', errors='replace') as lf:
            print(f"Server Log:\n{lf.read()}", flush=True)
        exit_code = 1
    finally:
        if server_process.poll() is None:
            server_process.terminate()
            try:
                server_process.wait(timeout=5)
            except Exception:
                server_process.kill()
        server_log_file.close()

        if os.path.exists(data_dir):
            shutil.rmtree(data_dir, ignore_errors=True)

    sys.exit(exit_code)


if __name__ == '__main__':
    main()
