[![Netlify Status](https://api.netlify.com/api/v1/badges/f96abed5-78e7-4435-abee-6bce5ee02e72/deploy-status)](https://app.netlify.com/sites/curious-truffle-d2e8fc/deploys)
# ローカルサーバーの立て方（Live Server & Python http.server）

## 目次
1. [VS CodeのLive Serverを使う方法](#vs-codeのlive-serverを使う方法)
   1. [Live Serverのインストール](#live-serverのインストール)
   2. [Live Serverの起動](#live-serverの起動)
   3. [ブラウザで確認](#ブラウザで確認)
   4. [サーバーの停止](#サーバーの停止)
2. [Pythonのhttp.serverを使う方法](#pythonのhttpserverを使う方法)
   1. [コマンドプロンプトでディレクトリ移動](#コマンドプロンプトでディレクトリ移動)
   2. [Pythonのローカルサーバーを起動](#pythonのローカルサーバーを起動)
   3. [ブラウザで確認](#ブラウザで確認-1)
   4. [サーバーの停止](#サーバーの停止-1)

---

## VS CodeのLive Serverを使う方法

### **Live Serverのインストール**
1. VS Codeを開く
2. 左側の拡張機能（Extensions）アイコンをクリック
3. 検索バーに `Live Server` と入力
4. `Live Server` を選択し、**インストール** をクリック

### **Live Serverの起動**
1. VS Codeで公開したいプロジェクトフォルダを開く
2. HTMLファイルを開く
3. 右下にある「**Go Live**」ボタンをクリック

### **ブラウザで確認**
Live Serverが起動すると、自動でブラウザが開きます。
開かない場合は、以下のURLにアクセスしてください。

```
http://127.0.0.1:5500/
```

### **サーバーの停止**
サーバーを停止するには、VS Codeの **「Port: 5500」** をクリックし、**「Stop Live Server」** を選択してください。

---

## Pythonのhttp.serverを使う方法

### **コマンドプロンプトでディレクトリ移動**
1. **Windowsの場合**
   - `Win + R` を押して `cmd` を入力し、Enter
   - `cd` コマンドを使って目的のディレクトリに移動

2. **Mac / Linuxの場合**
   - ターミナルを開く
   - `cd` コマンドを使って目的のディレクトリに移動

### **Pythonのローカルサーバーを起動**
以下のコマンドを実行すると、現在のディレクトリをローカルサーバーとして公開できます。

```
python -m http.server 8000
```

成功すると、以下のようなメッセージが表示されます。

```
Serving HTTP on :: port 8000 (http://[::]:8000/) ...
```

### **ブラウザで確認**
ブラウザを開いて、以下のURLにアクセスしてください。

```
http://localhost:8000/
```

このページで、対象ディレクトリのファイル一覧が表示されます。

### **サーバーの停止**
サーバーを停止するには、コマンドプロンプトまたはターミナルで以下の操作を行います。

- **Windows / Mac / Linux**： `Ctrl + C` を押す

```
^C
KeyboardInterrupt received, exiting.
```
