"""
fetch_nikkei225.py - 疎通確認版（V1 Bearer方式）

認証フロー:
  JQUANTS_API_KEY（リフレッシュトークン）
  → POST /v1/token/auth_refresh?refreshtoken=<token>
  → idToken 取得
  → Authorization: Bearer <idToken> で /listed/info を呼ぶ
"""

import os
import sys

try:
    import requests
except ImportError:
    print("ERROR: requests がインストールされていません。", flush=True)
    sys.exit(1)

REFRESH_TOKEN = os.environ.get("JQUANTS_API_KEY", "").strip()
BASE_URL = "https://api.jquants.com/v1"


def get_id_token() -> str:
    url = f"{BASE_URL}/token/auth_refresh"
    resp = requests.post(url, params={"refreshtoken": REFRESH_TOKEN}, timeout=30)
    print(f"  auth_refresh ステータス: {resp.status_code}", flush=True)
    print(f"  auth_refresh レスポンス: {resp.text[:300]}", flush=True)
    if not resp.ok:
        raise RuntimeError(f"idToken取得失敗 ({resp.status_code})")
    token = resp.json().get("idToken")
    if not token:
        raise RuntimeError(f"idTokenがレスポンスに含まれていません: {resp.text[:300]}")
    return token


def main():
    if not REFRESH_TOKEN:
        print("ERROR: JQUANTS_API_KEY が未設定です。", flush=True)
        sys.exit(1)

    print(f"REFRESH_TOKEN 長さ: {len(REFRESH_TOKEN)} 文字", flush=True)
    print(f"REFRESH_TOKEN 先頭10文字: {REFRESH_TOKEN[:10]}...", flush=True)

    print("\n--- Step1: idToken取得 ---", flush=True)
    try:
        id_token = get_id_token()
        print(f"  idToken取得成功 (先頭10文字: {id_token[:10]}...)", flush=True)
    except RuntimeError as e:
        print(f"FATAL: {e}", flush=True)
        sys.exit(1)

    print("\n--- Step2: /listed/info 呼び出し ---", flush=True)
    url = f"{BASE_URL}/listed/info"
    headers = {"Authorization": f"Bearer {id_token}"}
    resp = requests.get(url, headers=headers, timeout=30)
    print(f"  ステータスコード: {resp.status_code}", flush=True)
    print(f"  レスポンス: {resp.text[:300]}", flush=True)

    if resp.ok:
        count = len(resp.json().get("info", []))
        print(f"\n取得件数: {count} 社", flush=True)
        print("=== 疎通確認 OK ===", flush=True)
    else:
        print("=== 疎通確認 FAILED ===", flush=True)
        sys.exit(1)


if __name__ == "__main__":
    main()
