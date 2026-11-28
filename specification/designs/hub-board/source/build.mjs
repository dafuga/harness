/* global console */
// Writes the hub-board canvas (designs/hub-board) from the parts and sample data in this folder.
// Run from the repo root: bun specification/designs/hub-board/source/build.mjs
// Then format the artboards: bunx prettier --write designs/hub-board
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { screens } from './screens.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, '..', '..', '..', '..', 'designs', 'hub-board');
const sheets = ['tokens', 'base', 'shell', 'board', 'dock', 'chat', 'detail', 'phone', 'alt'];
const css = sheets.map((name) => readFileSync(join(here, 'css', `${name}.css`), 'utf8')).join('\n');

const page = ({ title, size, kind, body }) => `<!doctype html>
<html>
	<head>
		<meta charset="utf-8" />
		<meta name="artboard-size" content="${size[0]}x${size[1]}" />
		<title>${title}</title>
		<style>
${css}
		</style>
	</head>
	<body class="${kind}">
${body}
	</body>
</html>
`;

const boards = screens();
mkdirSync(out, { recursive: true });
for (const screen of boards) writeFileSync(join(out, screen.file), page(screen));

const manifest = {
	schemaVersion: 1,
	title: 'Hub home: the board (stats strip, four columns, agents dock)',
	artboards: boards.map(({ file, title, x, y }) => ({ file, title, x, y }))
};
writeFileSync(join(out, 'canvas.json'), `${JSON.stringify(manifest, null, '\t')}\n`);
console.log(`${boards.length} artboards written to designs/hub-board`);
