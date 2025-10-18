# mcp-github

GitHub の包括的な操作を行うための MCP (Model Context Protocol) サーバです。Issue、Pull Request、ブランチ、Git操作を、堅牢な認証システムとモジュラーアーキテクチャで提供します。

Claude Code などの MCP 互換クライアントから直接 GitHub ワークフローを管理できます—Issue作成、PR管理、ブランチ操作、Git操作をシームレスに実行可能です。

## ✨ 機能

### コア機能

**Issue管理（4ツール）**
- `create_issue` - 新しいIssueの作成
- `get_issue` - Issue詳細とコメントの取得
- `update_issue` - Issueの更新（タイトル、本文、状態）
- `add_issue_comment` - Issueへのコメント追加

**Pull Request管理（4ツール）**
- `create_pull_request` - 新しいPull Requestの作成
- `get_pull_request` - PR詳細とコメントの取得
- `update_pull_request` - PRの更新（タイトル、本文、状態、ベースブランチ）
- `get_pr_diff` - PRの差分（diff）取得

### 高度な機能
- **🔐 シンプル認証**: GitHub CLIによる認証
- **🏗️ モジュラー設計**: 明確な関心事の分離
- **🚀 ゼロコンフィグ**: GitHub CLIですぐに動作
- **⚡ TypeScript**: 完全な型安全性とモダンなESモジュール

## 🚀 クイックスタート

### インストール

```bash
cd mcp-github
npm install
npm run build
```

### 認証設定

#### GitHub CLI
```bash
# 一度だけ実行
gh auth login

# サーバーは自動的にGitHub CLI認証を使用します
```

### 設定

MCP クライアント設定（例: Claude Code）に追加：

```json
{
  "mcpServers": {
    "mcp-github": {
      "command": "node",
      "args": ["/path/to/MCP-GitHub/mcp-github/build/index.js"]
    }
  }
}
```

## 🏗️ アーキテクチャ

### ディレクトリ構造
```
MCP-GitHub/
├── README.md                    # このファイル
├── .gitignore                   # Git除外設定
└── mcp-github/                  # サーバー実装
    ├── src/
    │   ├── index.ts             # MCPサーバーエントリーポイント（8ツール）
    │   ├── api/
    │   │   ├── github-api.ts    # GitHub REST APIクライアント
    │   │   └── types.ts         # TypeScript型定義
    │   ├── auth/
    │   │   └── github-cli-auth.ts # 認証（GitHub CLI）
    │   └── utils/
    │       ├── logger.ts        # ログシステム
    │       └── helpers.ts       # ヘルパー関数
    ├── build/                   # コンパイル済みJavaScript
    ├── package.json
    └── tsconfig.json
```

### 主要コンポーネント
- **統合GitHub APIクライアント**: すべてのGitHub API操作を統合したAPI処理
- **GitHub CLI認証**: GitHub CLIによるシンプルな認証
- **完全な型安全性**: すべてのGitHub APIレスポンスに対する完全なTypeScript定義

## 🔧 開発

### ビルドコマンド
```bash
# 依存関係をインストール
npm install

# TypeScriptをJavaScriptにビルド
npm run build

# ウォッチモード（変更時に自動リビルド）
npm run watch

# ビルドディレクトリをクリーン
npm run clean
```


## 🐛 トラブルシューティング

### 認証の問題

**問題**: "GitHub authentication failed"

**解決方法**:
1. GitHub CLIで認証: `gh auth login`
2. 認証状態を確認: `gh auth status`
3. 必要に応じて再認証: `gh auth refresh`

### ビルドエラー

**問題**: TypeScriptコンパイルエラー

**解決方法**:
```bash
npm run clean
npm install
npm run build
```

### APIレート制限

**問題**: "API rate limit exceeded"

**解決方法**:
- 認証済みリクエストは高いレート制限があります（5000/時間 vs 60/時間）
- レート制限状況を確認: `gh api rate_limit`
- レート制限がリセットされるまで待つ
