# deno-cosense-mcp-server

Cosense MCP Server for Deno - Scrapboxのプロジェクトページを検索・取得するためのMCPサーバー

## 必要条件

- [Deno](https://deno.land/) v1.37.0以上

## 環境変数

サーバーを実行する前に、以下の環境変数を設定する必要があります：

- `COSENSE_PROJECT_NAME`: Scrapboxのプロジェクト名
- `COSENSE_SERVICE_ACCOUNT_ACCESS_KEY`: Scrapboxのサービスアカウントアクセスキー

## 実行方法

### 直接実行

```bash
deno run --allow-net --allow-env --allow-read --import-map=import_map.json server.ts
```

### Deno Tasksを使用

```bash
deno task start
```

## 提供されるツール

### cosense_search

キーワードによるScrapboxページの検索を行います。

パラメータ:
- `keywords`: 検索キーワード（スペース区切り）

### cosense_get_page

特定のScrapboxページの内容を取得します。

パラメータ:
- `title`: ページのタイトル

### cosense_syntax_rule

Cosenseの文法ルールを取得します。

パラメータ:
- なし（引数は必要ありません）
