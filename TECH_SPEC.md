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

## sign / timestamp の観測

同一時刻に観測した以下の異なるSSP APIで、同じ`timestamp`と同じ`sign`が使われていました。

```text
/ss/getDiscoveryList
/ss/queryCoOutfitNews
```

このため、`sign`はendpoint単位の署名ではなく、セッションまたは一定時間単位で複数SSP APIに共有される値である可能性が高いです。

別の時刻に再キャプチャすると`timestamp`と`sign`の両方が変化しました。

## GitHub Actionsからの再現試験

GitHub Actionsから`getDiscoveryList`へ同一ユーザー条件でアクセスし、以下を確認しました。

```text
古い timestamp + その時の sign
→ retcode 40020

現在時刻 + 古い sign
→ retcode 40021

新しくキャプチャした timestamp + 同時に取得した新しい sign
→ retcode 0 / 成功
```

成功時にはGitHub Actionsからおすすめ投稿12件を取得し、`gh-pages/data/discovery.json`へ正常に保存できました。

この結果から現時点でかなり強く言えること:

- 新鮮な`timestamp + sign`の組は、ゲーム端末ではなくGitHub Actions上の外部ホストからも再利用できる
- 少なくとも今回の試験では送信元IPや端末そのものへの強い固定は確認されなかった
- `timestamp`には鮮度チェック / 有効期限がある可能性が高い
- `sign`は固定値ではなく、`timestamp`またはセッション状態と関連している可能性が高い
- 古いsignだけを長期間Secretsへ固定する方式では完全自動更新できない可能性が高い

ただし、`40020`と`40021`の正式な意味は未確認です。エラーコードの意味そのものは断定しません。

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
- `sign`が更新される正確な条件 / 周期
- Discoveryのページネーション
- 新着 / 人気 / フォロー / 検索などのendpoint
- `getmomentreplylist`の`replyId`のページネーション仕様

未解析部分を推測で固定しないこと。

## 次の解析優先順位

1. 同一ゲームセッションで時間を空けて`getDiscoveryList`を複数回取得し、`timestamp`と`sign`の更新周期を比較
2. signが変わる瞬間を特定する
3. 同一timestampでさらに複数endpointのsign共有範囲を確認
4. `timestamp`の許容時間幅を安全な範囲で確認
5. 必要ならAPK / UEネイティブコード内のsign生成処理を解析
6. signをサーバー側で生成または安全に更新できるようになってから完全自動更新へ移行

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
