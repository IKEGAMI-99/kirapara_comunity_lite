# Kirapara Community Lite - 技術仕様メモ

最終更新: 2026-08-29

この文書は、PCAPdroidで確認した通信とGitHub Actions上での再現試験をもとにした現時点の仕様メモです。確認済み事項、観測結果、未解析事項を分けています。

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

## GitHub Actionsからの再現試験

キャプチャ時と同じ`serverId`、`gameId`、`userId`、`roleId`、`sign`、`timestamp`をGitHub Actionsから`getDiscoveryList`へ送信したところ、HTTP通信自体は成功し、APIからJSONのretcodeが返ることを確認しました。

観測結果:

```text
キャプチャ時の古い timestamp + キャプチャ時の sign
→ retcode 40020

現在時刻の timestamp + 同じ sign
→ retcode 40021
```

この差分から、少なくとも以下が強く示唆されます。

- `timestamp`には鮮度チェック / 有効期限がある可能性が高い
- `sign`は固定値ではなく、`timestamp`またはセッション状態と関連している可能性が高い
- キャプチャしたsignを長期間そのまま再利用する方式では自動運用できない可能性が高い

ただし、`40020`と`40021`の正式な意味は未確認です。現時点ではエラーコードの意味を断定しません。

クライアントは診断用に、固定timestampで`40020`を受けた場合のみ現在時刻で1回再試行します。両方失敗した場合は既存の公開Feedを維持します。

## 画像

投稿画像は`pic1`〜`pic6`。`photoId`には`|`区切りでportrait URLが含まれます。

APIレスポンスではHTTP URLが返る例があるため、HTTPSのGitHub Pagesで混在コンテンツにならないよう、取得処理で`https://`へアップグレードしています。

## 64-bit ID

`momentId`はJavaScriptの安全な整数範囲を超えます。APIは裸のJSON数値として返すため、通常の`JSON.parse`だけでは精度が失われます。

`kirapara-client.mjs`では既知のIDフィールドを文字列化してからparseし、公開データでもIDはstringとして保持します。

## 未解析

- `sign`の生成方式
- `sign`生成に使われる秘密値 / セッショントークンの有無
- `timestamp`の許容時間幅
- Discoveryのページネーション
- 新着 / 人気 / フォロー / 検索などのendpoint
- `getmomentreplylist`の`replyId`のページネーション仕様

未解析部分を推測で固定しないこと。

## 次の解析優先順位

1. PCAPdroidで新しい`getDiscoveryList`を2回以上取得し、`timestamp`と`sign`の変化を比較
2. 同一セッション内で数秒〜数分離れたリクエストのsignを比較
3. 同一timestampで別endpointを呼んだ場合のsignを比較
4. 必要ならAPK / UEネイティブコード内のsign生成処理を解析
5. signをサーバー側で生成できるようになってから完全自動更新へ移行

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
