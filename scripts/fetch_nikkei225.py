"""
fetch_nikkei225.py - 疎通確認版（J-Quants V2）

認証: x-api-key ヘッダーに JQUANTS_API_KEY を付与
疎通確認: GET /equities/master
"""

import os
import sys

try:
    import requests
except ImportError:
    print("ERROR: requests がインストールされていません。", flush=True)
    sys.exit(1)

API_KEY = os.environ.get("JQUANTS_API_KEY", "").strip()
BASE_URL = "https://api.jquants.com/v2"


def main():
    if not API_KEY:
        print("ERROR: JQUANTS_API_KEY が未設定です。", flush=True)
        sys.exit(1)

    print(f"API_KEY 長さ: {len(API_KEY)} 文字", flush=True)

    url = f"{BASE_URL}/equities/master"
    headers = {"x-api-key": API_KEY}

    print(f"GET {url}", flush=True)
    resp = requests.get(url, headers=headers, timeout=30)

    print(f"ステータスコード: {resp.status_code}", flush=True)
    print(f"レスポンス: {resp.text[:500]}", flush=True)

    if resp.ok:
        data = resp.json()
        count = len(data) if isinstance(data, list) else len(data.get("items", data.get("data", [])))
        print(f"取得件数: {count} 件", flush=True)
        print("=== 疎通確認 OK ===", flush=True)
    else:
        print("=== 疎通確認 FAILED ===", flush=True)
        sys.exit(1)


if __name__ == "__main__":
    main()
