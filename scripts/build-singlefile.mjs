/**
 * dist/ を単一の HTML にまとめる。
 *
 * 「とりあえず触ってみたい」ときのための出力。サーバーに置かなくても、
 * ファイルをブラウザで開くだけで全機能が動く（音もリアルタイム合成なので鳴る）。
 * Service Worker とマニフェストは単一ファイルでは意味がないので外す。
 *
 *   npm run build && node scripts/build-singlefile.mjs
 */

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const assets = join(dist, 'assets');

const files = readdirSync(assets);
const jsFiles = files.filter((f) => f.endsWith('.js'));
const cssFiles = files.filter((f) => f.endsWith('.css'));
if (jsFiles.length === 0 || cssFiles.length === 0) {
  throw new Error('dist/assets にビルド結果がありません。先に npm run build を実行してください');
}
// 動的 import を1つ足すとチャンクが分かれる。黙って片方だけ埋め込むと
// 例外も出ないまま壊れた HTML ができるので、ここで止める
if (jsFiles.length > 1 || cssFiles.length > 1) {
  throw new Error(
    `チャンクが複数あります（js: ${jsFiles.join(', ')} / css: ${cssFiles.join(', ')}）。` +
      '単一ファイル化にはバンドルを1つにまとめる必要があります',
  );
}

const css = readFileSync(join(assets, cssFiles[0]), 'utf8');
const js = readFileSync(join(assets, jsFiles[0]), 'utf8');

// バンドル中の文字列リテラルに </script が現れると、そこで HTML の解析が終わってしまう
const safeJs = js.replaceAll('</script', '<\\/script');

// doctype と charset は必須。
// doctype が無いと互換モードに落ちて全画面レイアウトの前提が変わり、
// charset が無いと file:// で開いたときにロケール既定の文字コードで解釈されて文字化けする
const out = `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
<title>静か — 瞑想と呼吸</title>
<style>
${css}
</style>
</head>
<body>
<div id="root"></div>
<script type="module">
${safeJs}
</script>
</body>
</html>
`;

const target = process.argv[2] ?? join(dist, 'shizuka-single.html');
writeFileSync(target, out);
console.log(`${target}  ${(Buffer.byteLength(out) / 1024).toFixed(0)} KB`);
