# Kirapara Community Lite

『きらめきパラダイス』のゲーム内コミュニティを、ゲームを起動せずWebブラウザから閲覧するための軽量・非公式ビューアです。

現在はゲーム内の **「おすすめ / Discovery」** フィードのみ対応しています。取得処理とUIをFeed Provider単位に分離しているため、通信仕様が判明したら新着・人気・フォロー・検索などを後から追加できます。

> 非公式プロジェクトです。ゲーム運営会社・開発会社とは関係ありません。当面は閲覧専用で、投稿・いいね・コメント送信などの書き込み機能は実装しません。

## 現在の機能

- `POST /ss/getDiscoveryList` からおすすめ投稿を取得
- 投稿者名、アイコン、タイトル、本文、最大6枚の画像を表示
- vote数、コメント数、保存数を表示
- 15分ごとにGitHub Actionsで更新
- 生成済みサイトを `gh-pages` ブランチへ自動発行
- 前回正常取得したFeedを復元してから更新し、認証未設定時や取得不能時に既存公開データを不用意に消さない
- APIパーサー / 正規化処理の自己テストをCIで実行
- 巨大な`momentId`を文字列として保持し、JavaScriptの整数精度問題を回避
- API認証値をフロントエンドへ出さない構成
- Feed Provider方式で将来のタブ追加に対応

## 現在のAPI疎通状況

GitHub ActionsからSSP APIへ到達し、JSONのretcodeが返るところまでは確認済みです。

キャプチャ時の古い`timestamp`と`sign`をそのまま再利用すると`retcode=40020`、現在時刻へ差し替えて同じ`sign`を使うと`retcode=40021`になりました。

このため、現時点では**キャプチャしたsignは固定値として長期再利用できず、timestampまたはセッション状態と関連している可能性が高い**と判断しています。正式なエラーコードの意味は未確認なので断定はしていません。

完全自動更新にはsign生成方式の追加解析が必要です。取得失敗時はActionsを失敗扱いにせず、直前の公開Feedを維持します。

詳しい観測結果は [TECH_SPEC.md](./TECH_SPEC.md) に記録しています。

## 構成

```text
.github/workflows/deploy-pages.yml  定期取得 + gh-pages発行
scripts/
  fetch-feed.mjs                   共通Feed取得エントリ
  self-test.mjs                    パーサー / 正規化の自己テスト
  lib/
    kirapara-client.mjs            SSP APIクライアント
    normalize.mjs                  公開用データへ正規化
  providers/
    discovery.mjs                  おすすめFeed Provider
docs/
  index.html                       静的サイト本体
  app.js                           タブ / 投稿カード描画
  styles.css                       UI
  data/discovery.json              公開用キャッシュ
TECH_SPEC.md                       現在判明している通信仕様
```

## GitHub Pagesを有効にする

ActionsはPages APIを直接有効化せず、公開用ファイルを `gh-pages` ブランチへ発行します。

初回のみ、このリポジトリのGitHubで次を設定してください。

1. `Settings` → `Pages`
2. `Build and deployment`
3. `Source` を **Deploy from a branch**
4. Branchを **`gh-pages`**
5. Folderを **`/ (root)`**
6. `Save`

デプロイ後のURLは通常次の形式です。

```text
https://ikegami-99.github.io/kirapara_comunity_lite/
```

`gh-pages` ブランチ自体はActionsが自動生成・更新します。

## Actions Secrets

`Settings` → `Secrets and variables` → `Actions` → `New repository secret` から設定します。

必須:

| Secret | 内容 |
|---|---|
| `KRPR_SERVER_ID` | API呼び出し元アカウントのserverId |
| `KRPR_SIGN` | キャプチャで確認したsign |
| `KRPR_USER_ID` | `xxxxxxxx$zulong@xxxxx`形式のuserId |
| `KRPR_ROLE_ID` | API呼び出し元のroleId |

任意:

| Secret | 初期値 / 用途 |
|---|---|
| `KRPR_GAME_ID` | 未設定なら`22701201` |
| `KRPR_TIMESTAMP` | キャプチャ時の再現試験用。未設定なら実行時の現在時刻(ms) |

Secrets未設定時やAPI取得失敗時は、直前の `gh-pages` に公開済みのFeedがあればそれを維持します。初回で公開済みFeedもない場合は空表示です。

### 重要

`sign`、`userId`、`roleId`、ログイントークン、PCAPなどをREADME・JavaScript・JSON・Issueへ直接書かないでください。リポジトリは公開されているため、コミットした時点で外部から取得可能になります。

## 手動更新

`Actions` → `Refresh community and publish site` → `Run workflow` で即時更新できます。

通常は15分間隔で自動実行します。

## 自己テスト

以下でAPI JSONの64-bit ID保持、画像URLのHTTPS化、投稿正規化をテストできます。

```bash
node scripts/self-test.mjs
```

ActionsでもFeed取得前に毎回実行します。

## ローカル確認

静的サイトなので、簡単なHTTPサーバーで確認できます。

```bash
python3 -m http.server 8080 -d docs
```

その後 `http://localhost:8080` を開きます。

API取得をローカルで試す場合は、環境変数を設定した上で:

```bash
node scripts/fetch-feed.mjs discovery
```

成功すると `docs/data/discovery.json` が更新されます。

## 新しいタブを追加する

例として「新着」APIが判明した場合:

1. `scripts/providers/latest.mjs` を作成
2. 共通形式 `{ posts, nextCursor }` を返す
3. `scripts/fetch-feed.mjs` のProvider Mapへ登録
4. Workflowで `node scripts/fetch-feed.mjs latest` を実行
5. `docs/app.js` の `FEEDS` に `latest` を追加

UI側は共通の投稿カードをそのまま使えます。

## 既知のAPI

| Endpoint | 状態 | 用途 |
|---|---|---|
| `/ss/getDiscoveryList` | 確認済み | おすすめ一覧 |
| `/ss/getmomentbyid` | 確認済み | 投稿詳細 |
| `/ss/getmomentreplylist` | 確認済み | コメント一覧 |

より詳しい解析メモは [TECH_SPEC.md](./TECH_SPEC.md) を参照してください。

## 未解決

特に重要なのは以下です。

- `sign`の生成方法 / 有効期限
- `timestamp`と`sign`の関係
- Discoveryの追加読み込み方法
- 新着・人気など他タブのAPI

現在はキャプチャで確認できた事実だけを実装し、未解析部分は固定値や推測で決め打ちしない方針です。

## ライセンス / 利用上の注意

このリポジトリのコードは検証・個人利用を目的としています。ゲーム側APIやコンテンツの権利は各権利者に帰属します。公開運用する場合は、利用規約、APIへの負荷、投稿者のプライバシー、コンテンツの扱いを確認してください。
