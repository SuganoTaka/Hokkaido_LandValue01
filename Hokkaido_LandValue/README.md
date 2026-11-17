# 北海道 地価マップ

国土数値情報の地価公示・都道府県地価調査をOpenStreetMap上に表示します。APIキーやビルド用パッケージは不要です。

## ローカルで確認

このフォルダーで次を実行し、`http://127.0.0.1:8000` を開きます。

```powershell
python -m http.server 8000 --bind 127.0.0.1 --directory public
```

## GitHubとRenderへの公開

1. このフォルダーの内容をGitHubリポジトリのルートに登録します。`public/app.js` も登録されていることを確認します。
2. Renderの「New > Blueprint」でリポジトリを接続し、ルートにある `render.yaml` を選択します。
3. Blueprintを適用すると、`public` を公開する静的サイトが作成されます。環境変数の設定は不要です。

既存のリポジトリ内に `Hokkaido_LandValue` フォルダーとして登録する場合は、Blueprintのパスを `Hokkaido_LandValue/render.yaml` に設定し、`render.yaml` のサービスに `rootDir: Hokkaido_LandValue` を追加してください。

## データと注意点

- 収録データは地価公示2025年（1月1日時点）と都道府県地価調査2026年（7月1日時点）です。更新には `public/data/land-values.json` の差し替えと再デプロイが必要です。
- 出典：[国土数値情報 地価公示](https://nlftp.mlit.go.jp/ksj/gml/datalist/KsjTmplt-L01-2025.html)、[国土数値情報 都道府県地価調査](https://nlftp.mlit.go.jp/ksj/gml/datalist/KsjTmplt-L02-2026.html)（CC BY 4.0）。
- 地図はLeafletとOpenStreetMapの標準タイルを使用します。利用にはインターネット接続が必要です。公開・大量利用時は[タイル利用ポリシー](https://operations.osmfoundation.org/policies/tiles/)を確認してください。
