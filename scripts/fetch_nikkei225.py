"""
fetch_nikkei225.py
J-Quants API V2 (API Key方式) で日経225の財務データを取得し、
investment-library/data/nikkei225.json に出力する。

認証: x-api-key ヘッダーに JQUANTS_API_KEY を付与
"""

import os
import json
import time
import sys
from datetime import datetime, timedelta

try:
    import requests
except ImportError:
    print("ERROR: requests がインストールされていません。pip install requests を実行してください。", flush=True)
    sys.exit(1)

# ── 設定 ─────────────────────────────────────────────
API_KEY = os.environ.get("JQUANTS_API_KEY", "").strip()
BASE_URL = "https://api.jquants.com/v1"
OUTPUT_PATH = os.path.join(
    os.path.dirname(__file__), "..", "investment-library", "data", "nikkei225.json"
)

# 日経225 構成銘柄コード（2024年時点）
NIKKEI225_CODES = [
    "1301","1332","1605","1721","1801","1802","1803","1808","1812",
    "1925","1928","2002","2269","2282","2413","2502","2503","2531",
    "2768","2801","2802","2871","2914","3101","3103","3105","3401",
    "3402","3404","3405","3407","3436","3659","3861","3863","4004",
    "4005","4021","4042","4043","4061","4063","4183","4188","4208",
    "4307","4324","4452","4502","4503","4506","4507","4519","4523",
    "4543","4568","4578","4631","4661","4689","4704","4751","4755",
    "4901","4902","4911","5019","5020","5101","5108","5201","5202",
    "5214","5232","5233","5301","5332","5333","5401","5406","5411",
    "5413","5631","5706","5711","5713","5714","5715","5802","5803",
    "5901","6098","6103","6113","6178","6301","6302","6305","6326",
    "6361","6367","6369","6376","6383","6412","6479","6501","6503",
    "6504","6506","6526","6586","6594","6645","6647","6701","6702",
    "6703","6724","6752","6753","6758","6762","6770","6841","6857",
    "6861","6902","6952","6954","6963","6971","6976","6981","7003",
    "7004","7011","7012","7013","7201","7202","7203","7205","7211",
    "7261","7267","7269","7270","7272","7282","7731","7733","7735",
    "7741","7751","7752","7762","7832","7911","7912","7951","8001",
    "8002","8003","8005","8015","8031","8035","8053","8058","8233",
    "8252","8267","8301","8304","8306","8308","8309","8316","8331",
    "8354","8355","8411","8601","8604","8630","8725","8729","8750",
    "8766","8795","8801","8802","8804","8830","9001","9005","9007",
    "9008","9009","9020","9021","9022","9064","9101","9104","9107",
    "9202","9301","9432","9433","9434","9501","9502","9503","9531",
    "9532","9602","9613","9735","9766","9983","9984",
]

# ── API ヘルパー ──────────────────────────────────────
def api_get(path: str, params: dict = None) -> dict:
    """
    GET リクエストを送信して JSON を返す。
    失敗時は詳細なエラーメッセージを出力して例外を送出する。
    """
    url = f"{BASE_URL}{path}"
    headers = {
        "x-api-key": API_KEY,
        "Content-Type": "application/json",
    }
    try:
        resp = requests.get(url, headers=headers, params=params, timeout=30)
    except requests.exceptions.ConnectionError as e:
        raise RuntimeError(f"[接続エラー] {url}\n  詳細: {e}") from e
    except requests.exceptions.Timeout:
        raise RuntimeError(f"[タイムアウト] {url}")

    if resp.status_code == 401:
        raise RuntimeError(
            f"[認証失敗 401] JQUANTS_API_KEY が無効または期限切れです。\n"
            f"  URL: {url}\n  Response: {resp.text[:300]}"
        )
    if resp.status_code == 403:
        raise RuntimeError(
            f"[アクセス拒否 403] このエンドポイントはプランで利用できない可能性があります。\n"
            f"  URL: {url}\n  Response: {resp.text[:300]}"
        )
    if not resp.ok:
        raise RuntimeError(
            f"[APIエラー {resp.status_code}] {url}\n  Response: {resp.text[:300]}"
        )

    return resp.json()


# ── データ取得関数 ────────────────────────────────────
def fetch_listed_info() -> dict:
    """上場企業情報を取得し、コード→社名のマップを返す"""
    print("  上場企業情報を取得中...", flush=True)
    data = api_get("/listed/info")
    info_map = {}
    for item in data.get("info", []):
        code = item.get("Code", "")[:4]
        info_map[code] = {
            "name": item.get("CompanyName", ""),
            "sector": item.get("Sector17CodeName", ""),
        }
    return info_map


def fetch_all_quotes(date_str: str) -> dict:
    """指定日の全銘柄株価を一括取得し、コード→株価データのマップを返す"""
    print(f"  株価データを取得中 (日付: {date_str})...", flush=True)
    data = api_get("/prices/daily_quotes", params={"date": date_str})
    quotes_map = {}
    for q in data.get("daily_quotes", []):
        code = q.get("Code", "")[:4]
        quotes_map[code] = {
            "close": q.get("Close"),
            "per": q.get("PER"),
            "pbr": q.get("PBR"),
        }
    return quotes_map


def fetch_latest_statements(code: str) -> dict | None:
    """指定銘柄の最新財務諸表を取得する"""
    data = api_get("/fins/statements", params={"code": code})
    stmts = data.get("statements", [])
    if not stmts:
        return None
    latest = stmts[-1]
    return {
        "roe": latest.get("ROE"),
        "eps": latest.get("EarningsPerShare"),
        "bps": latest.get("BookValuePerShare"),
        "net_sales": latest.get("NetSales"),
        "operating_profit": latest.get("OperatingProfit"),
        "net_income": latest.get("Profit"),
        "fiscal_year_end": latest.get("CurrentFiscalYearEndDate"),
        "disclosure_date": latest.get("DisclosedDate"),
    }


def fetch_announcements() -> dict:
    """決算発表予定を取得し、コード→発表情報のマップを返す"""
    print("  決算発表予定を取得中...", flush=True)
    data = api_get("/fins/announcement")
    ann_map = {}
    for item in data.get("announcement", []):
        code = item.get("Code", "")[:4]
        ann_map[code] = {
            "announcement_date": item.get("AnnouncementDate"),
            "fiscal_year_end": item.get("FiscalYearEndDate"),
        }
    return ann_map


# ── メイン処理 ────────────────────────────────────────
def main():
    if not API_KEY:
        print("ERROR: 環境変数 JQUANTS_API_KEY が設定されていません。", flush=True)
        sys.exit(1)

    print(f"=== 日経225データ取得開始 ({datetime.now().strftime('%Y-%m-%d %H:%M:%S')}) ===", flush=True)

    # 直近の営業日を取得（土日はスキップ）
    today = datetime.now()
    offset = 1
    while True:
        target_date = today - timedelta(days=offset)
        if target_date.weekday() < 5:
            break
        offset += 1
    date_str = target_date.strftime("%Y%m%d")

    errors = []
    results = []

    # Step 1: 上場企業情報
    try:
        info_map = fetch_listed_info()
    except RuntimeError as e:
        print(f"FATAL: 上場企業情報の取得に失敗しました。\n{e}", flush=True)
        sys.exit(1)

    # Step 2: 株価（全銘柄一括）
    try:
        quotes_map = fetch_all_quotes(date_str)
    except RuntimeError as e:
        print(f"FATAL: 株価データの取得に失敗しました。\n{e}", flush=True)
        sys.exit(1)

    # Step 3: 決算発表予定
    try:
        ann_map = fetch_announcements()
    except RuntimeError as e:
        print(f"WARNING: 決算発表予定の取得に失敗しました（スキップ）。\n{e}", flush=True)
        ann_map = {}

    # Step 4: 各銘柄の財務諸表
    print(f"  財務諸表を取得中 (対象: {len(NIKKEI225_CODES)} 銘柄)...", flush=True)
    for i, code in enumerate(NIKKEI225_CODES, 1):
        info = info_map.get(code, {})
        quote = quotes_map.get(code, {})
        ann = ann_map.get(code, {})

        stmt = None
        try:
            stmt = fetch_latest_statements(code)
        except RuntimeError as e:
            err_msg = f"  [{i}/{len(NIKKEI225_CODES)}] {code} 財務諸表取得失敗: {e}"
            print(err_msg, flush=True)
            errors.append({"code": code, "error": str(e)})

        per = quote.get("per")
        pbr = quote.get("pbr")
        roe = stmt.get("roe") if stmt else None

        if per is None and stmt and stmt.get("eps") and quote.get("close"):
            try:
                per = round(float(quote["close"]) / float(stmt["eps"]), 2)
            except (ZeroDivisionError, TypeError, ValueError):
                per = None

        if pbr is None and stmt and stmt.get("bps") and quote.get("close"):
            try:
                pbr = round(float(quote["close"]) / float(stmt["bps"]), 2)
            except (ZeroDivisionError, TypeError, ValueError):
                pbr = None

        results.append({
            "code": code,
            "name": info.get("name", ""),
            "sector": info.get("sector", ""),
            "close": quote.get("close"),
            "per": per,
            "pbr": pbr,
            "roe": roe,
            "net_sales": stmt.get("net_sales") if stmt else None,
            "operating_profit": stmt.get("operating_profit") if stmt else None,
            "net_income": stmt.get("net_income") if stmt else None,
            "fiscal_year_end": stmt.get("fiscal_year_end") if stmt else None,
            "disclosure_date": stmt.get("disclosure_date") if stmt else None,
            "next_announcement": ann.get("announcement_date"),
        })

        if i % 30 == 0:
            print(f"  ... {i}/{len(NIKKEI225_CODES)} 完了", flush=True)
        time.sleep(0.3)

    # Step 5: JSON 出力
    output = {
        "updated_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S JST"),
        "data_date": date_str,
        "count": len(results),
        "errors": errors,
        "stocks": results,
    }

    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    print(f"\n=== 完了 ===", flush=True)
    print(f"  取得成功: {len(results) - len(errors)} / {len(NIKKEI225_CODES)} 銘柄", flush=True)
    if errors:
        print(f"  取得失敗: {len(errors)} 銘柄（詳細は上記ログ参照）", flush=True)
    print(f"  出力先: {OUTPUT_PATH}", flush=True)

    if errors:
        sys.exit(1)


if __name__ == "__main__":
    main()
