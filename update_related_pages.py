#!/usr/bin/env python3
"""Update Related Pages section in all company pages with same-industry competitor links."""

import os
import re

BASE = "C:/Users/mineo/Desktop/lifehack-roadmap/investment-library/companies"

# Industry → companies mapping
# (dir_name, display_name, ticker)
INDUSTRIES = {
    "banking": {
        "label": "銀行業",
        "path": "banking",
        "companies": [
            ("mufg",       "三菱UFJ FG",     "8306"),
            ("smfg",       "三井住友FG",      "8316"),
            ("mizuho",     "みずほFG",        "8411"),
            ("resona",     "りそなHD",        "8308"),
            ("concordia",  "コンコルディアFG", "7186"),
        ]
    },
    "it-telecom": {
        "label": "IT・通信",
        "path": "it-telecom",
        "companies": [
            ("ntt",      "NTT",        "9432"),
            ("kddi",     "KDDI",       "9433"),
            ("softbank", "ソフトバンクG", "9984"),
            ("nttdata",  "NTTデータG",  "9613"),
            ("fujitsu",  "富士通",      "6702"),
            ("recruit",  "リクルートHD", "6098"),
        ]
    },
    "automotive": {
        "label": "自動車",
        "path": "automotive",
        "companies": [
            ("toyota",    "トヨタ自動車",   "7203"),
            ("honda",     "ホンダ",         "7267"),
            ("denso",     "デンソー",       "6902"),
            ("aisin",     "アイシン",       "7259"),
            ("toyotaind", "豊田自動織機",   "6201"),
        ]
    },
    "machinery": {
        "label": "機械",
        "path": "machinery",
        "companies": [
            ("komatsu", "コマツ",     "6301"),
            ("daikin",  "ダイキン工業", "6367"),
            ("dmgmori", "DMG森精機",  "6141"),
            ("smc",     "SMC",        "6273"),
        ]
    },
    "electronics": {
        "label": "電気機器",
        "path": "electronics",
        "companies": [
            ("keyence", "キーエンス",  "6861"),
            ("fanuc",   "ファナック",  "6954"),
            ("hitachi", "日立製作所",  "6501"),
            ("nidec",   "ニデック",    "6594"),
            ("omron",   "オムロン",    "6645"),
            ("kyocera", "京セラ",      "6971"),
            ("sony",    "ソニーG",     "6758"),
        ]
    },
    "chemicals": {
        "label": "化学",
        "path": "chemicals",
        "companies": [
            ("shinEtsu",      "信越化学工業",   "4063"),
            ("asahi-kasei",   "旭化成",         "3407"),
            ("nippon-paint",  "日本ペイントHD", "4612"),
            ("mitsubishi-chem","三菱ケミカルG", "4188"),
            ("fujifilm",      "富士フイルムHD", "4901"),
        ]
    },
    "food": {
        "label": "食品",
        "path": "food",
        "companies": [
            ("nissin",    "日清食品HD",  "2897"),
            ("meiji",     "明治HD",      "2269"),
            ("kikkoman",  "キッコーマン", "2801"),
            ("ajinomoto", "味の素",       "2802"),
            ("kirin",     "キリンHD",    "2503"),
        ]
    },
    "wholesale": {
        "label": "卸売業",
        "path": "wholesale",
        "companies": [
            ("misho",           "三菱商事",   "8058"),
            ("itochu",          "伊藤忠商事", "8001"),
            ("mitsui-bussan",   "三井物産",   "8031"),
            ("sumitomo-shoji",  "住友商事",   "8053"),
            ("marubeni",        "丸紅",       "8002"),
        ]
    },
    "insurance": {
        "label": "保険業",
        "path": "insurance",
        "companies": [
            ("tokiomarine", "東京海上HD",  "8766"),
            ("msad",        "MS&ADHD",     "8725"),
            ("sompo",       "SOMPO HD",    "8630"),
            ("daiichi-life","第一生命HD",  "8750"),
        ]
    },
    "pharma": {
        "label": "医薬品",
        "path": "pharma",
        "companies": [
            ("takeda",       "武田薬品工業", "4502"),
            ("chugai",       "中外製薬",     "4519"),
            ("daiichi-sankyo","第一三共",    "4568"),
            ("eisai",        "エーザイ",     "4523"),
            ("shionogi",     "塩野義製薬",   "4507"),
        ]
    },
    "real-estate": {
        "label": "不動産業",
        "path": "real-estate",
        "companies": [
            ("mitsui-fudosan",    "三井不動産",   "8801"),
            ("mitsubishi-jisho",  "三菱地所",     "8802"),
            ("sumitomo-fudosan",  "住友不動産",   "8830"),
            ("tokyu-fudosan",     "東急不動産HD", "3289"),
            ("hulic",             "ヒューリック",  "3003"),
        ]
    },
    "construction": {
        "label": "建設業",
        "path": "construction",
        "companies": [
            ("obayashi", "大林組",     "1802"),
            ("kajima",   "鹿島建設",   "1812"),
            ("shimizu",  "清水建設",   "1803"),
            ("taisei",   "大成建設",   "1801"),
            ("daiwa-house","大和ハウス工業","1925"),
        ]
    },
    "retail": {
        "label": "小売業",
        "path": "retail",
        "companies": [
            ("fastretailing", "ファーストリテイリング", "9983"),
            ("seven-i",       "セブン&アイHD",        "3382"),
            ("aeon",          "イオン",                "8267"),
            ("monotaro",      "MonotaRO",              "3064"),
            ("nitori",        "ニトリHD",              "9843"),
        ]
    },
    "services": {
        "label": "サービス業",
        "path": "services",
        "companies": [
            ("dentsu",       "電通グループ",     "4324"),
            ("persol",       "パーソルHD",       "2181"),
            ("cyberagent",   "サイバーエージェント","4751"),
            ("cybozu",       "サイボウズ",        "4776"),
        ]
    },
}

def build_competitor_links(industry_key, current_company_dir):
    """Build HTML for competitor links in an industry."""
    industry = INDUSTRIES[industry_key]
    lines = []
    for (dir_name, display_name, ticker) in industry["companies"]:
        if dir_name == current_company_dir:
            continue
        lines.append(f'      <a class="related-link" href="../{dir_name}/">')
        lines.append(f'        <span class="related-tag">PEER</span>')
        lines.append(f'        <span class="related-title">{display_name} ({ticker})</span>')
        lines.append(f'        <span class="related-arrow">→</span>')
        lines.append(f'      </a>')
    return "\n".join(lines)

def update_company_page(company_dir, industry_key):
    """Update a single company page's related section."""
    path = os.path.join(BASE, company_dir, "index.html")
    if not os.path.exists(path):
        print(f"  MISSING: {path}")
        return False

    with open(path, "r", encoding="utf-8") as f:
        content = f.read()

    # Check if already updated
    if 'related-tag">PEER<' in content:
        print(f"  ✓ already updated: {company_dir}")
        return False

    competitor_html = build_competitor_links(industry_key, company_dir)

    # Insert competitor links right after <div class="related-links">
    old_marker = '<div class="related-links">'
    if old_marker not in content:
        print(f"  MARKER_MISSING: {company_dir}")
        return False

    new_content = content.replace(
        old_marker,
        old_marker + "\n" + competitor_html,
        1
    )

    if new_content == content:
        print(f"  NO_CHANGE: {company_dir}")
        return False

    with open(path, "w", encoding="utf-8") as f:
        f.write(new_content)

    print(f"  OK: {company_dir}")
    return True

def main():
    updated = 0
    skipped = 0
    errors = 0

    for industry_key, industry_data in INDUSTRIES.items():
        print(f"\n[{industry_data['label']}] ({industry_key})")
        for (company_dir, display_name, ticker) in industry_data["companies"]:
            result = update_company_page(company_dir, industry_key)
            if result:
                updated += 1
            elif result is False:
                skipped += 1

    print(f"\n{'='*40}")
    print(f"完了: {updated}社更新 / {skipped}社スキップ")

if __name__ == "__main__":
    main()
