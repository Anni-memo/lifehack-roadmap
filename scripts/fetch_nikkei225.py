"""
fetch_nikkei225.py - J-Quants V2 本実装

認証: x-api-key ヘッダー
エンドポイント:
  GET /equities/master      - 銘柄マスタ
  GET /equities/bars/daily  - 株価四本値（from/to）
  GET /fins/summary         - 財務情報（code）
"""

import os
import json
import time
import sys
from datetime import datetime, timedelta

try:
    import requests
except ImportError:
    print("ERROR: requests がインストールされていません。", flush=True)
    sys.exit(1)

API_KEY  = os.environ.get("JQUANTS_API_KEY", "").strip()
BASE_URL = "https://api.jquants.com/v2"
OUTPUT_PATH = os.path.join(
    os.path.dirname(__file__), "..", "investment-library", "data", "nikkei225.json"
)

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
    url = f"{BASE_URL}{path}"
    headers = {"x-api-key": API_KEY}
    try:
        resp = requests.get(url, headers=headers, params=params, timeout=30)
    except requests.exceptions.ConnectionError as e:
        raise RuntimeError(f"[接続エラー] {url}: {e}") from e
    except requests.exceptions.Timeout:
        raise RuntimeError(f"[タイムアウト] {url}")

    if not resp.ok:
        raise RuntimeError(
            f"[APIエラー {resp.status_code}] {url}\n  Response: {resp.text[:300]}"
        )
    return resp.json()


def find_items(data: dict) -> list:
    """レスポンスから items 配列を取り出す（キー名のゆれに対応）"""
    for key in ("items", "data", "info", "bars", "summary"):
        if key in data and isinstance(data[key], list):
            return data[key]
    # リスト自体が返ってきた場合
    if isinstance(data, list):
        return data
    return []


def fetch_all_pages(path: str, params: dict = None, debug_label: str = "") -> list:
    """ページネーション対応の全件取得"""
    params = dict(params or {})
    results = []
    page = 1
    while True:
        data = api_get(path, params)

        # 初回のみ生データ構造をデバッグ出力
        if page == 1 and debug_label:
            keys = list(data.keys()) if isinstance(data, dict) else type(data).__name__
            first = find_items(data)[:1]
            print(f"  [{debug_label}] レスポンスキー: {keys}", flush=True)
            print(f"  [{debug_label}] 先頭1件: {json.dumps(first, ensure_ascii=False)[:300]}", flush=True)

        items = find_items(data)
        results.extend(items)

        pagination_key = data.get("pagination_key") if isinstance(data, dict) else None
        if not pagination_key:
            break
        params["pagination_key"] = pagination_key
        page += 1

    return results


# ── 日付ヘルパー ──────────────────────────────────────
def prev_business_day(base: datetime) -> str:
    offset = 1
    while True:
        candidate = base - timedelta(days=offset)
        if candidate.weekday() < 5:
            return candidate.strftime("%Y-%m-%d")
        offset += 1


def fetch_bars_with_fallback(date: str) -> list:
    """
    /equities/bars/daily を呼び出す。
    契約範囲外エラーが返ってきた場合、レスポンスから上限日を抽出して自動リトライ。
    """
    import re
    try:
        return fetch_all_pages(
            "/equities/bars/daily",
            params={"date": date},
            debug_label="bars/daily",
        )
    except RuntimeError as e:
        msg = str(e)
        print(f"  bars/daily エラー: {msg}", flush=True)

        # "subscription covers: YYYY-MM-DD ~ YYYY-MM-DD" を抽出
        m = re.search(r"subscription covers.*?(\d{4}-\d{2}-\d{2})\s*~\s*(\d{4}-\d{2}-\d{2})", msg)
        if m:
            sub_start, sub_end = m.group(1), m.group(2)
            print(f"  契約範囲: {sub_start} ~ {sub_end}", flush=True)

            # リクエスト日が上限を超えていたら上限日の直近営業日で再試行
            if date > sub_end:
                fallback = prev_business_day(
                    datetime.strptime(sub_end, "%Y-%m-%d") + timedelta(days=1)
                )
                print(f"  → {date} は範囲外。{fallback} で再試行します。", flush=True)
                return fetch_all_pages(
                    "/equities/bars/daily",
                    params={"date": fallback},
                    debug_label="bars/daily(fallback)",
                )

        raise


# ── メイン処理 ────────────────────────────────────────
def main():
    if not API_KEY:
        print("ERROR: JQUANTS_API_KEY が未設定です。", flush=True)
        sys.exit(1)

    print(f"=== 日経225データ取得開始 ({datetime.now().strftime('%Y-%m-%d %H:%M:%S')}) ===", flush=True)
    date = prev_business_day(datetime.now())
    print(f"  対象日: {date}", flush=True)
    n225_set = set(NIKKEI225_CODES)

    # Step 1: 銘柄マスタ
    print("\n--- Step1: /equities/master ---", flush=True)
    try:
        master_items = fetch_all_pages("/equities/master", debug_label="master")
    except RuntimeError as e:
        print(f"FATAL: {e}", flush=True)
        sys.exit(1)

    master_map = {}
    for item in master_items:
        # キー名はデバッグ出力で確認後に調整
        code = str(item.get("code", item.get("Code", "")))[:4]
        if code in n225_set:
            master_map[code] = {
                "name": item.get("companyName", item.get("CompanyName", item.get("name", ""))),
                "sector": item.get("sector17Name", item.get("sectorName", item.get("Sector17CodeName", ""))),
            }
    print(f"  日経225銘柄マッチ: {len(master_map)} 社", flush=True)

    # Step 2: 株価四本値
    print(f"\n--- Step2: /equities/bars/daily (date={date}) ---", flush=True)
    try:
        bars_items = fetch_bars_with_fallback(date)
    except RuntimeError as e:
        print(f"FATAL: {e}", flush=True)
        sys.exit(1)

    quotes_map = {}
    for item in bars_items:
        code = str(item.get("code", item.get("Code", "")))[:4]
        if code in n225_set:
            quotes_map[code] = {
                "close": item.get("close", item.get("Close")),
                "per":   item.get("per",   item.get("PER")),
                "pbr":   item.get("pbr",   item.get("PBR")),
            }

    # Step 3: 財務情報
    print(f"\n--- Step3: /fins/summary ({len(NIKKEI225_CODES)} 銘柄) ---", flush=True)
    fins_map = {}
    errors = []
    first_fins = True
    for i, code in enumerate(NIKKEI225_CODES, 1):
        try:
            items = fetch_all_pages(
                "/fins/summary",
                params={"code": code},
                debug_label="fins/summary" if first_fins else "",
            )
            first_fins = False
            if items:
                latest = items[-1]
                fins_map[code] = {
                    "roe":              latest.get("roe",             latest.get("ROE")),
                    "eps":              latest.get("eps",             latest.get("EPS",             latest.get("earningsPerShare"))),
                    "bps":              latest.get("bps",             latest.get("BPS",             latest.get("bookValuePerShare"))),
                    "net_sales":        latest.get("netSales",        latest.get("NetSales")),
                    "operating_profit": latest.get("operatingProfit", latest.get("OperatingProfit")),
                    "net_income":       latest.get("netIncome",       latest.get("NetIncome",       latest.get("profit", latest.get("Profit")))),
                    "fiscal_year_end":  latest.get("fiscalYearEnd",   latest.get("FiscalYearEnd",   latest.get("CurrentFiscalYearEndDate"))),
                    "disclosure_date":  latest.get("disclosureDate",  latest.get("DisclosureDate",  latest.get("DisclosedDate"))),
                }
        except RuntimeError as e:
            print(f"  [{i}/{len(NIKKEI225_CODES)}] {code} 失敗: {e}", flush=True)
            errors.append({"code": code, "error": str(e)})

        if i % 30 == 0:
            print(f"  ... {i}/{len(NIKKEI225_CODES)} 完了", flush=True)
        time.sleep(0.3)

    # Step 4: 結合・出力
    results = []
    for code in NIKKEI225_CODES:
        master = master_map.get(code, {})
        quote  = quotes_map.get(code, {})
        fins   = fins_map.get(code, {})

        per = quote.get("per")
        pbr = quote.get("pbr")
        roe = fins.get("roe")

        if per is None and fins.get("eps") and quote.get("close"):
            try:
                per = round(float(quote["close"]) / float(fins["eps"]), 2)
            except (ZeroDivisionError, TypeError, ValueError):
                pass

        if pbr is None and fins.get("bps") and quote.get("close"):
            try:
                pbr = round(float(quote["close"]) / float(fins["bps"]), 2)
            except (ZeroDivisionError, TypeError, ValueError):
                pass

        results.append({
            "code":             code,
            "name":             master.get("name", ""),
            "sector":           master.get("sector", ""),
            "close":            quote.get("close"),
            "per":              per,
            "pbr":              pbr,
            "roe":              roe,
            "net_sales":        fins.get("net_sales"),
            "operating_profit": fins.get("operating_profit"),
            "net_income":       fins.get("net_income"),
            "fiscal_year_end":  fins.get("fiscal_year_end"),
            "disclosure_date":  fins.get("disclosure_date"),
        })

    output = {
        "updated_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S JST"),
        "data_date":  date,
        "count":      len(results),
        "errors":     errors,
        "stocks":     results,
    }

    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    print(f"\n=== 完了 ===", flush=True)
    print(f"  取得成功: {len(results) - len(errors)} / {len(NIKKEI225_CODES)} 銘柄", flush=True)
    if errors:
        print(f"  取得失敗: {len(errors)} 銘柄", flush=True)
    print(f"  出力先: {OUTPUT_PATH}", flush=True)

    if errors:
        sys.exit(1)


if __name__ == "__main__":
    main()
