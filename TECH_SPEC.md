# Kirapara Community Lite - 技術仕様メモ

最終更新: 2026-08-29

この文書は、PCAPdroidで確認した通信をもとにした現時点の仕様メモです。確認済み事項と未解析事項を分けています。

## 確認済み

APIホスト:

```text
https://ssp-projecti-jp.archosaur.com
```

通信はHTTPS + HTTP/1.1。確認したAPIはいずれも`POST`で、本文は空、引数はquery stringに付与されます。

共通して観測した引数:

```text
serverId
gameId=22701201
sign
timestamp
userId
roleId
```

### おすすめ / Discovery

```text
POST /ss/getDiscoveryList
```

レスポンス:

```json
{
  "retcode": 0,
  "momentList": [],
  "roleId": 0
}
```

`momentList`には投稿ID、投稿者名、本文、タイトル、投稿画像URL、アイコンURL、投稿時刻、vote数、reply数などが含まれることを確認済みです。

### 投稿詳細

```text
POST /ss/getmomentbyid
```

追加引数:

```text
momentId
```

### コメント一覧

```text
POST /ss/getmomentreplylist
```

確認した追加引数:

```text
momentId
replyId
```

## 画像

投稿画像は`pic1`〜`pic6`。`photoId`には`|`区切りでportrait URLが含まれます。

APIレスポンスではHTTP URLが返る例があるため、HTTPSのGitHub Pagesで混在コンテンツにならないよう、取得処理で`https://`へアップグレードしています。

## 64-bit ID

`momentId`はJavaScriptの安全な整数範囲を超えます。APIは裸のJSON数値として返すため、通常の`JSON.parse`だけでは精度が失われます。

`kirapara-client.mjs`では既知のIDフィールドを文字列化してからparseし、公開データでもIDはstringとして保持します。

## 未解析

- `sign`の生成方式と有効期限
- `timestamp`が毎リクエスト現在時刻なのか、セッション値なのか
- Discoveryのページネーション
- 新着 / 人気 / フォロー / 検索などのendpoint
- `getmomentreplylist`の`replyId`のページネーション仕様

未解析部分を推測で固定しないこと。

## 拡張方針

取得側はFeed Provider単位で追加します。

```text
scripts/providers/
  discovery.mjs
  latest.mjs       # 将来
  popular.mjs      # 将来
  following.mjs    # 将来
```

Providerの返却値は共通化します。

```js
{
  posts: Moment[],
  nextCursor: string | null
}
```

フロント側は`docs/app.js`の`FEEDS`へタブ設定を追加し、カードUIは共通で再利用します。

## セキュリティ

以下を公開ファイルへ書かないこと。

- sign
- userId
- roleId
- ログイントークン
- PCAP / SSLKEYLOGFILE

GitHub Actions Secretsで管理します。

当面は閲覧専用とし、投稿、いいね、コメント送信などの書き込みAPIは実装しません。
