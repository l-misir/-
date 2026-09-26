---
description: 実機の差枚データから通常時純減係数を逆算する
argument-hint: <機種> 通常G BIG REG ベル 実機差枚 [...複数件]
---

実機データから差枚係数を逆算します: $ARGUMENTS

1. 該当機種の `calcDiffReal` を読み、BIG純増・REG純増・ベル払出・現行係数を確認する
2. 各データについて `係数 = (BIG×BIG純増 + REG×REG純増 + ベル×ベル払出 − 実機差枚) / 通常G` を計算
3. 現行係数での表示値、逆算係数、平均係数を採用した場合の各データの誤差を表で示す
4. 逆算値のばらつきが大きい（±0.02超）場合は、入力ミスや機種固有の要因（ニューキングⅤのスイカこぼし・BTベル等）を疑い、更新を勧めない
5. ユーザーが採用を了承したら `calcDiffReal` を更新し、`tests/diff.test.js` の `CASES` と `docs/CALIBRATION.md` にデータを追記して `npm test`

ニューキングⅤは構造的に合わないため調整しない方針（docs/CALIBRATION.md）。
