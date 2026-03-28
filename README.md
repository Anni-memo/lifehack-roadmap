# ライフハック講師プロジェクト

AIを活用した情報発信 × ライフハック講師への道

---

## ドキュメント一覧

| ファイル | 内容 | 読む順番 |
|---------|------|--------|
| `01_ロードマップ.md` | 全体の進め方・フェーズ別計画 | 最初 |
| `02_Claude_Code説明書.md` | Claude Codeの使い方（初心者向け） | 2番目 |
| `03_コンテンツパイプライン説明書.md` | 音声→X→HPの仕組み | 3番目 |
| `04_ライフハック講師への道.md` | 講師として成功する戦略 | 4番目 |
| `05_プロンプト集.md` | すぐ使えるClaude指示文一覧 | 必要なとき随時 |

---

## 今すぐやること

1. **`01_ロードマップ.md`** を読む（15分）
2. **`02_Claude_Code説明書.md`** を読む（20分）
3. **今日の気づきを録音して**、Claudeに投稿文を作ってもらう（10分）
4. **Xのプロフィールを更新する**（`05_プロンプト集.md`のプロンプトを使う）

---

## Claude Code の使い方（このプロジェクトで）

```bash
# ターミナルでこのフォルダを開いて claude を起動
cd C:\Users\mineo\ClaudeProjects
claude
```

その後、日本語で普通に話しかければOKです。

例：「今日のモーニングメソッドの気づきを投稿文にして」

---

*Claude Code があなたのコンサルタント＆エージェントとしてサポートします。*
## 日経225 財務データ自動取得の設定

### 概要

J-Quants API V2 を利用して、日経225 構成銘柄の財務データ（PER / PBR / ROE 等）を
GitHub Actions で毎営業日自動取得し、`investment-library/data/nikkei225.json` に保存します。

### 必要なもの

- J-Quants のアカウント（無料プランで可）
- J-Quants ダッシュボードで発行した **API Key**

### GitHub Secrets への登録

1. リポジトリの **Settings → Secrets and variables → Actions** を開く
2. **New repository secret** をクリック
3. 以下を入力して保存する

   | 項目 | 値 |
   |---|---|
   | Name | `JQUANTS_API_KEY` |
   | Secret | J-Quants ダッシュボードの API Key |

### 自動実行スケジュール

`.github/workflows/fetch-nikkei225.yml` により、
**平日 20:30 JST（東証終値確定後）** に自動実行されます。

手動実行は GitHub リポジトリの **Actions タブ → Fetch Nikkei 225 Data → Run workflow** から可能です。

### 出力データ形式

`investment-library/data/nikkei225.json`

```json
{
  "updated_at": "2025-01-20 20:35:00 JST",
  "data_date": "20250120",
  "count": 225,
  "errors": [],
  "stocks": [
    {
      "code": "7203",
      "name": "トヨタ自動車",
      "sector": "輸送用機器",
      "close": 3200.0,
      "per": 9.8,
      "pbr": 1.1,
      "roe": 12.5,
      "net_sales": 43000000000000,
      "operating_profit": 5000000000000,
      "net_income": 4500000000000,
      "fiscal_year_end": "2025-03-31",
      "disclosure_date": "2024-11-06",
      "next_announcement": "2025-05-08"
    }
  ]
}
```

### エラーが出た場合

Actions タブのログに詳細が表示されます。主な原因：

| エラー | 対処 |
|---|---|
| `認証失敗 401` | API Key が正しいか Secrets を再確認 |
| `アクセス拒否 403` | J-Quants プランでそのエンドポイントが使えない |
| `接続エラー` | J-Quants サーバーの一時障害。再実行で解決することが多い |
