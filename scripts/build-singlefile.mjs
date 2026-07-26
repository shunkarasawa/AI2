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
const jsName = files.find((f) => f.endsWith('.js'));
const cssName = files.find((f) => f.endsWith('.css'));
if (!jsName || !cssName) throw new Error('dist/assets にビルド結果がありません。先に npm run build を実行してください');

const css = readFileSync(join(assets, cssName), 'utf8');
const js = readFileSync(join(assets, jsName), 'utf8');

const out = `<title>静か — 瞑想と呼吸</title>
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
<style>
${css}
</style>
<div id="root"></div>
<script type="module">
${js}
</script>
`;

const target = process.argv[2] ?? join(dist, 'shizuka-single.html');
writeFileSync(target, out);
console.log(`${target}  ${(out.length / 1024).toFixed(0)} KB`);
