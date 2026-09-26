# データモデル

## 1. localStorage（キー: `hana_v20_data`）

キー名を変えると既存ユーザーのデータが見えなくなるので**変更禁止**。

```jsonc
{
  "machine": "newking",          // 選択中の機種 ID
  "mode": "tap",                 // 'tap' | 'input'（入力モード）
  "viewMode": "personal",        // 'personal'（打ち始めからの差分）| 'total'（台の累計）
  "gasUrl": "https://script.google.com/macros/s/.../exec",
  "gasToken": "hanahana2026",
  "weights": {                   // 要素調整（%）。機種ごと
    "newking": { "b":40, "r":40, "gas":40, "bell":50, "sui":20, "suiR":15,
                 "sl":75, "morn":5, "bl":20, "rl":100, "ret":5 }
    // houou / king / dragon / star は suiR なし
  },
  "houou":   { /* 機種データ */ },
  "king":    { },
  "dragon":  { },
  "star":    { },
  "newking": {
    "start": { "g":0, "b":0, "r":0 },                 // 打ち始め
    "cur":   { "g":0, "b":0, "r":0, "bell":0,
               "suika":0, "suikaR":0,                 // suikaR はニューキングのみ使用
               "retro_d":0, "retro":0 },              // レトロ条件達成 / 発生
    "lamps": {
      "big":  [0,0,0,0,0],   // BIG筐体ランプ 青黄緑 赤(紫) 虹
      "regS": [0,0,0,0,0],   // 他機種=REGサイドランプ / ニューキング=BIG後半サイドランプ 青黄緑赤虹
      "regT": [0,0,0,0,0]    // REG筐体ランプ。ニューキングは4色(青黄緑紫)のみ使用
    },
    "morning": -1,           // 朝一BIG筐体ランプ: -1=未選択 0=白 1=青 2=黄 3=緑 4=赤/紫
    "hits": [                // 大当たり履歴。先頭が最新
      { "g": 230, "k": "b" },
      { "g": null, "k": "r" } // g=null は回転数未入力
    ]
  }
}
```

`loadData()` は欠けたキーを `DEFAULTS` で補完する。構造を足すときは `loadData()` にも補完処理を追加すること（古い保存データでクラッシュさせない）。

### 朝一ランプ
朝一のBIGランプは**色カウンターには入れない**。`morning` にだけ記録し、詳細データの該当色に下線を引く。推測では BIG回数を1回分減らして白の誤計上を防ぎ、偶奇示唆は `mornRate` で別途反映する。

## 2. 大当たり履歴 `hits`

### 意味
データカウンターは BIG/REG どちらでも当選で回転数が0に戻る。`g` はその表示値＝「直前の当たりからの通常時回転数」。

```
時系列:  [着席] --300G--> BIG --300G--> REG --100G--> REG ... --230G--> BIG --170G--> (現在)
hits:    [ {230,b}, ..., {100,r}, {300,r}, {300,b} ]   ← 先頭が最新
hitTailG = 170（最新の当たり以降のハマり）
cur.g    = start.g + Σg + hitTailG
```

### 種別フィルタ
BIG タブなら BIG 間、REG タブなら REG 間の実間隔を出す。古い順に走査し、対象種別が来るまで区間を積算する。

```
入力（新→古）: 230B 100R 80R 10R 220R 35R 95R 100R 300R 300B
BIG → [1170, 300]         1170 = 300R以降の全区間 + 230
REG → [100,80,10,220,35,95,100,600]   600 = 300R + 手前の300B区間
```

「現在ハマり」表示: 全体=hitTailG、BIG/REG=hitTailG＋最新から対象種別までの異種区間。

### 操作と整合性
| 操作 | 処理 |
|---|---|
| BIG/REG を +1 | 記録 `{g:null}` を先頭に作成 → テンキーでG入力（入力のたび即反映、閉じても残る）。`hitTailG=0` |
| BIG/REG を -1 | 実際に値が減った時だけ `removeLatestHit(kind)`。区間Gは idx-1 へ繰り入れ（最新なら hitTailG へ） |
| 履歴のG数をタップ | `editHitG(idx)`。ハマりを固定し、最初の数字入力で既存値を上書き |
| 入力モード / まとめて加算で BIG を増やす | `hits` は変化しない（仕様） |

確率表の実績は `g != null` の記録だけで集計する（`null <= 100` が true になる JS の罠に注意）。

## 3. スプレッドシート

機種ごとに1シート。A列は空欄、B列から。**生データのみ**で末尾4列は空欄。

### ニューキングⅤ（シート名: `ニューキングハナハナⅤ` 全角）
| 列 | idx | 内容 |
|---|---|---|
| A | 0 | 空 |
| B | 1 | 日付 |
| C | 2 | 総回転数（通常時＋ボーナス中） |
| D | 3 | 通常時回転数 |
| E | 4 | ボーナス回転数（BIG×26 + REG×10） |
| F / G | 5 / 6 | BIG / REG |
| H | 7 | ベル(通常時) |
| I / J | 8 / 9 | スイカ(BIG前半) / スイカ(REG) |
| K–O | 10–14 | BIG後半サイド 青黄緑赤虹 → `lamps.regS` |
| P–T | 15–19 | BIG筐体 青黄緑紫虹 → `lamps.big` |
| U–X | 20–23 | REG筐体 青黄緑紫 → `lamps.regT[0..3]` |
| Y / Z | 24 / 25 | レトロ達成 / 発生 |
| AA–AD | 26–29 | 推測設定 / 高設定期待度 / 差枚数 / 復元用JSON（空欄） |

### ホウオウ / キング / ドラゴン / スター
シート名: `ハナハナホウオウ天翔` / `キングハナハナ` / `ドラゴンハナハナ閃光` / `スターハナハナ`

| 列 | idx | 内容 |
|---|---|---|
| B–H | 1–7 | 日付 / 総回転数 / 通常時 / ボーナス回転数 / BIG / REG / ベル |
| I | 8 | スイカ(BIG) |
| J–N | 9–13 | BIG筐体 青黄緑赤虹 → `lamps.big` |
| O–S | 14–18 | REGサイド 青黄緑赤虹 → `lamps.regS` |
| T–X | 19–23 | REG筐体 青黄緑赤虹 → `lamps.regT` |
| Y / Z | 24 / 25 | レトロ達成 / 発生 |
| AA–AD | 26–29 | 空欄 |

C列が数値でない行はヘッダーとみなして読み飛ばす。

## 4. GAS Web App API（`gas/Code.gs`）

全リクエストに `token` が必要（不一致は `{"error":"unauthorized"}`）。

| メソッド | パラメータ | 動作 |
|---|---|---|
| GET | `action=getAll&token=` | `KNOWN_SHEETS` の全行を `{sheet,row,values[]}` で返す。Date は `yyyy/MM/dd HH:mm` |
| GET | `action=delete&sheet=&row=&token=` | 指定行を削除 |
| POST | body `{token, sheetName, headers, rowData}` | シートが無ければ headers 付きで作成し、rowData を追記 |

POST は CORS プリフライト回避のため `Content-Type: text/plain;charset=utf-8` で送る。
