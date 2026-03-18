"""
fetch_nikkei225.py - J-Quants V2 本実装

認証: x-api-key ヘッダー
エンドポイント:
  GET /equities/master      - 銘柄マスタ
  GET /equities/bars/daily  - 株価四本値（date）
  GET /fins/summary         - 財務情報（date 一括 → 失敗時 code 個別）
"""

import os
import json
import time
import sys
import re
from datetime import datetime, timedelta
from collections import Counter

try:
    import requests
except ImportError:
    print("ERROR: requests がインストールされていません。", flush=True)
    sys.exit(1)

API_KEY  = os.environ.get("JQUANTS_API_KEY", "").strip()
BASE_URL = "https://api.jquants.com/v2"

# OUTPUT_PATH: GitHub Actions では GITHUB_WORKSPACE、ローカルは __file__ 基準
_repo_root = os.environ.get("GITHUB_WORKSPACE") or os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..")
)
OUTPUT_PATH = os.path.join(_repo_root, "investment-library", "data", "nikkei225.json")

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

# ── コード正規化 ──────────────────────────────────────
def normalize_code(raw) -> str:
    """
    APIが返すコード（4桁 or 5桁）を 4桁表示コードに正規化する。
    例: "13010" -> "1301",  "1301" -> "1301",  13010 -> "1301"
    """
    s = str(raw).strip().lstrip("0") if not str(raw).strip().startswith("0") else str(raw).strip()
    # 数字のみ抽出
    digits = "".join(c for c in s if c.isdigit())
    # 5桁で末尾が"0"なら先頭4桁が銘柄コード
    if len(digits) == 5 and digits.endswith("0"):
        return digits[:4]
    return digits[:4]

# 4桁→5桁変換セット（APIが5桁を返す場合の逆引き用）
N225_SET_4  = set(NIKKEI225_CODES)                          # {"1301", ...}
N225_SET_5  = {c + "0" for c in NIKKEI225_CODES}           # {"13010", ...}
N225_ALL    = N225_SET_4 | N225_SET_5                       # 両方受け付ける

# ── API ヘルパー ──────────────────────────────────────
def api_get(path: str, params: dict = None, max_retries: int = 3) -> dict:
    """429 は指数バックオフでリトライ。それ以外のエラーは即例外。"""
    url = f"{BASE_URL}{path}"
    headers = {"x-api-key": API_KEY}
    for attempt in range(max_retries + 1):
        try:
            resp = requests.get(url, headers=headers, params=params, timeout=30)
        except requests.exceptions.ConnectionError as e:
            raise RuntimeError(f"[接続エラー] {url}: {e}") from e
        except requests.exceptions.Timeout:
            raise RuntimeError(f"[タイムアウト] {url}")

        if resp.status_code == 429:
            wait = 2 ** attempt
            print(f"  [429 Rate limit] {wait}s 待機してリトライ ({attempt+1}/{max_retries})...", flush=True)
            time.sleep(wait)
            continue

        if not resp.ok:
            raise RuntimeError(
                f"[APIエラー {resp.status_code}] {url}\n  Response: {resp.text[:300]}"
            )
        return resp.json()

    raise RuntimeError(f"[429 リトライ上限] {url}")


def find_items(data) -> list:
    if isinstance(data, list):
        return data
    # J-Quants V2 の既知レスポンスキーを網羅
    for key in ("daily_quotes", "items", "data", "info", "bars",
                "summary", "fins_summary", "equities", "master"):
        if key in data and isinstance(data[key], list):
            return data[key]
    return []


def fetch_all_pages(path: str, params: dict = None, debug_label: str = "") -> list:
    params = dict(params or {})
    results = []
    page = 1
    while True:
        data = api_get(path, params)
        if page == 1 and debug_label:
            # レスポンスの生キーを必ず出力（find_items 前に確認できるよう）
            raw_keys = list(data.keys()) if isinstance(data, dict) else type(data).__name__
            print(f"  [{debug_label}] レスポンスキー: {raw_keys}", flush=True)
            items_raw = find_items(data)
            if items_raw:
                print(f"  [{debug_label}] 先頭1件: {json.dumps(items_raw[0], ensure_ascii=False)[:500]}", flush=True)
            else:
                print(f"  [{debug_label}] ※ find_items が空を返しました（上記キーを要確認）", flush=True)
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


def resolve_date_with_fallback(date: str, path: str, extra_params: dict = None) -> tuple[list, str]:
    """
    指定 date でフェッチ。契約範囲外エラーなら上限日に補正してリトライ。
    (items, 実際に使用した date) を返す。
    """
    params = {"date": date, **(extra_params or {})}
    try:
        items = fetch_all_pages(path, params=params, debug_label=path.split("/")[-1])
        return items, date
    except RuntimeError as e:
        msg = str(e)
        m = re.search(r"subscription covers.*?(\d{4}-\d{2}-\d{2})\s*~\s*(\d{4}-\d{2}-\d{2})", msg)
        if m:
            sub_start, sub_end = m.group(1), m.group(2)
            print(f"  契約範囲: {sub_start} ~ {sub_end}", flush=True)
            if date > sub_end:
                fallback = prev_business_day(
                    datetime.strptime(sub_end, "%Y-%m-%d") + timedelta(days=1)
                )
                print(f"  → {date} は範囲外。{fallback} で再試行します。", flush=True)
                items = fetch_all_pages(path, params={"date": fallback, **(extra_params or {})},
                                        debug_label=f"{path.split('/')[-1]}(fallback)")
                return items, fallback
        raise


def parse_fins(item: dict) -> dict:
    # J-Quants V2 /fins/summary の実フィールド名（PascalCase）を優先して試みる
    return {
        "roe":              item.get("ROE",                   item.get("roe")),
        "eps":              item.get("EarningsPerShare",      item.get("eps",  item.get("EPS"))),
        "bps":              item.get("BookValuePerShare",     item.get("bps",  item.get("BPS"))),
        "net_sales":        item.get("NetSales",              item.get("netSales")),
        "operating_profit": item.get("OperatingProfit",       item.get("operatingProfit")),
        "net_income":       item.get("Profit",                item.get("netIncome", item.get("NetIncome"))),
        "fiscal_year_end":  item.get("CurrentFiscalYearEndDate", item.get("FiscalYearEnd",  item.get("fiscalYearEnd"))),
        "disclosure_date":  item.get("DisclosedDate",         item.get("DisclosureDate",    item.get("disclosureDate"))),
    }


# ── メイン処理 ────────────────────────────────────────
def main():
    if not API_KEY:
        print("ERROR: JQUANTS_API_KEY が未設定です。", flush=True)
        sys.exit(1)

    print(f"=== 日経225データ取得開始 ({datetime.now().strftime('%Y-%m-%d %H:%M:%S')}) ===", flush=True)
    print(f"  出力先: {OUTPUT_PATH}", flush=True)
    date = prev_business_day(datetime.now())
    print(f"  対象日: {date}", flush=True)
    # Step 1: 銘柄マスタ
    print("\n--- Step1: /equities/master ---", flush=True)
    try:
        master_items = fetch_all_pages("/equities/master", debug_label="master")
    except RuntimeError as e:
        print(f"FATAL: {e}", flush=True)
        sys.exit(1)

    # 先頭3件のコード正規化を確認
    print("  [master] コード正規化確認（先頭3件）:", flush=True)
    for item in master_items[:3]:
        raw = item.get("code", item.get("Code", ""))
        norm = normalize_code(raw)
        hit = norm in N225_SET_4
        print(f"    元コード={raw!r} → 正規化={norm!r} → N225マッチ={hit}", flush=True)

    master_map = {}
    for item in master_items:
        raw  = item.get("code", item.get("Code", ""))
        norm = normalize_code(raw)
        if norm in N225_SET_4:
            master_map[norm] = {
                "name":   item.get("CoName", ""),
                "sector": item.get("S17Nm", ""),
            }
    print(f"  日経225銘柄マッチ: {len(master_map)} 社", flush=True)
    if master_map:
        fc = next(iter(master_map))
        print(f"  [master] マッチ例 ({fc}): {master_map[fc]}", flush=True)

    # Step 2: 株価四本値
    print(f"\n--- Step2: /equities/bars/daily ---", flush=True)
    try:
        bars_items, bars_date = resolve_date_with_fallback(date, "/equities/bars/daily")
    except RuntimeError as e:
        print(f"FATAL: {e}", flush=True)
        sys.exit(1)

    if bars_items:
        print(f"  [bars] 先頭1件の全キー: {list(bars_items[0].keys())}", flush=True)
        print(f"  [bars] 先頭1件の値: {json.dumps(bars_items[0], ensure_ascii=False)[:400]}", flush=True)

    quotes_map = {}
    for item in bars_items:
        raw  = item.get("Code", item.get("code", ""))
        norm = normalize_code(raw)
        if norm in N225_SET_4:
            quotes_map[norm] = {
                # V2 bars/daily: Close (終値) または AdjustmentClose (調整後終値)
                "close": item.get("Close",           item.get("AdjustmentClose", item.get("close"))),
                "per":   item.get("PER",             item.get("per")),
                "pbr":   item.get("PBR",             item.get("pbr")),
            }
    print(f"  日経225株価取得: {len(quotes_map)} 社", flush=True)

    # Step 3: 財務情報（date 一括取得を先に試みる）
    print(f"\n--- Step3: /fins/summary ---", flush=True)
    fins_map = {}
    errors = []

    print("  date 一括取得を試みます...", flush=True)
    try:
        fins_items, _ = resolve_date_with_fallback(bars_date, "/fins/summary")
        # 一括取得成功 → コード別に最新レコードを選択
        code_fins: dict[str, list] = {}
        for item in fins_items:
            # V2 fins/summary は LocalCode を使う場合あり
            norm = normalize_code(item.get("LocalCode", item.get("Code", item.get("code", ""))))
            if norm in N225_SET_4:
                code_fins.setdefault(norm, []).append(item)
        for norm, items in code_fins.items():
            fins_map[norm] = parse_fins(items[-1])
        print(f"  一括取得成功: {len(fins_map)} 社", flush=True)

    except RuntimeError as e:
        print(f"  一括取得失敗 ({e})。個別取得に切り替えます。", flush=True)
        first = True
        for i, code in enumerate(NIKKEI225_CODES, 1):
            try:
                items = fetch_all_pages(
                    "/fins/summary",
                    params={"code": code},
                    debug_label="fins/summary" if first else "",
                )
                first = False
                if items:
                    fins_map[code] = parse_fins(items[-1])
            except RuntimeError as err:
                print(f"  [{i}/{len(NIKKEI225_CODES)}] {code} 失敗: {err}", flush=True)
                errors.append({"code": code, "error": str(err)})

            if i % 30 == 0:
                print(f"  ... {i}/{len(NIKKEI225_CODES)} 完了", flush=True)
            time.sleep(1.0)  # 個別取得時はレート制御を厚めに

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

    # [final] 先頭3件の確認ログ
    print("\n--- [final] 先頭3件確認 ---", flush=True)
    for s in results[:3]:
        print(
            f"  [final] {s['code']} name={s['name']!r} sector={s['sector']!r} "
            f"price={s['close']} updatedAt={bars_date} per={s['per']} pbr={s['pbr']}",
            flush=True,
        )

    # 常に JSON を保存（partial success でも）
    output = {
        "updated_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S JST"),
        "data_date":  bars_date,
        "count":      len(results),
        "errors":     errors,
        "stocks":     results,
    }
    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    # 集計サマリ
    print(f"\n=== 完了 ===", flush=True)
    print(f"  取得成功: {len(results) - len(errors)} / {len(NIKKEI225_CODES)} 銘柄", flush=True)
    if errors:
        print(f"  取得失敗: {len(errors)} 銘柄", flush=True)
        reason_counts = Counter(
            e["error"].split("]")[0].lstrip("[") if "]" in e["error"] else e["error"][:40]
            for e in errors
        )
        for reason, count in reason_counts.most_common():
            print(f"    - {reason}: {count} 件", flush=True)
    print(f"  出力先: {OUTPUT_PATH}", flush=True)


if __name__ == "__main__":
    main()
