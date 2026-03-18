"""
fetch_nikkei225.py - 最小疎通確認版
listed/info への1リクエストのみ実行して認証を確認する。
"""

import os
import sys

try:
    import requests
except ImportError:
    print("ERROR: requests がインストールされていません。", flush=True)
    sys.exit(1)

API_KEY = os.environ.get("JQUANTS_API_KEY", "").strip()
BASE_URL = "https://api.jquants.com/v1"

def main():
    if not API_KEY:
        print("ERROR: JQUANTS_API_KEY が未設定です。", flush=True)
        sys.exit(1)

    print(f"API_KEY 長さ: {len(API_KEY)} 文字", flush=True)
    print(f"API_KEY 先頭10文字: {API_KEY[:10]}...", flush=True)

    url = f"{BASE_URL}/listed/info"
    headers = {"x-api-key": API_KEY}

    print(f"\nリクエスト: GET {url}", flush=True)
    print(f"ヘッダー: x-api-key = {API_KEY[:10]}...", flush=True)

    resp = requests.get(url, headers=headers, timeout=30)

    print(f"\nステータスコード: {resp.status_code}", flush=True)
    print(f"レスポンス: {resp.text[:500]}", flush=True)

    if resp.ok:
        data = resp.json()
        count = len(data.get("info", []))
        print(f"\n取得件数: {count} 社", flush=True)
        print("=== 疎通確認 OK ===", flush=True)
    else:
        print("\n=== 疎通確認 FAILED ===", flush=True)
        sys.exit(1)

if __name__ == "__main__":
    main()
