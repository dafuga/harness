import { execFile } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { afterAll, expect, test } from 'vitest';

const cli = resolve(import.meta.dirname, '../../../src/index.ts');
const root = mkdtempSync(join(tmpdir(), 'design-cli-'));
afterAll(() => rmSync(root, { recursive: true, force: true }));
const run = promisify(execFile);
const environment = { ...process.env };
const design = async (...args: string[]) =>
	(await run('bun', [cli, 'design', ...args], { cwd: root, env: environment })).stdout.trim();

/** A PNG's size is in its header: bytes 16-23. */
const pngSize = (path: string) => {
	const bytes = readFileSync(path);
	return [bytes.readUInt32BE(16), bytes.readUInt32BE(20)];
};

test('an agent authors a canvas, lists it and renders PNGs at each declared size', async () => {
	await design('new', 'cards', '--title', 'Cards');
	await design('add', 'cards', 'Phone', '--size', 'mobile');
	writeFileSync(
		join(root, 'in.html'),
		'<meta name="artboard-size" content="600x400"><style>:root{background:#fff}' +
			':root[data-theme="dark"]{background:#000}</style><p>x</p>'
	);
	await design('add', 'cards', 'Wide', '--from', 'in.html', '--order', '1', '--title', 'Wide one');
	await design('update', 'cards', 'Phone', '--title', 'Phone one');
	expect(await design('list')).toBe('cards  2 artboards  Cards');
	expect(JSON.parse(await design('list', 'cards', '--json'))).toMatchObject([
		{ file: 'Wide.html', size: '600x400', x: 0, problems: [] },
		{ file: 'Phone.html', size: '390x844', x: 680, problems: [] }
	]);
	await design('render', 'cards', '--out', 'shots');
	expect(pngSize(join(root, 'shots/Phone.light.png'))).toEqual([390, 844]);
	expect(pngSize(join(root, 'shots/Wide.dark.png'))).toEqual([600, 400]);
	const light = readFileSync(join(root, 'shots/Wide.light.png'));
	expect(light.equals(readFileSync(join(root, 'shots/Wide.dark.png')))).toBe(false);
}, 90_000);

test('a refused artboard fails the command and says why', async () => {
	writeFileSync(join(root, 'bad.html'), '<script></script>');
	await expect(design('add', 'cards', 'Bad', '--from', 'bad.html')).rejects.toThrow(/has a script/);
	await expect(design('render', 'missing')).rejects.toThrow(/No canvas/);
}, 30_000);

/** Stands in for the tracker CLI: answers `show` and keeps what `artifact` was handed. */
function fakeTracker(folder: string) {
	mkdirSync(folder);
	const script = `#!/bin/sh
if [ "$1" = show ]; then echo '{"planning":{"artifacts":{"design":{"summary":"Kept"}}}}'
else echo "$1 $2 $3" > "${folder}/call"; cp "$4" "${folder}/artifact.json"; fi
`;
	writeFileSync(join(folder, 'tracker'), script);
	chmodSync(join(folder, 'tracker'), 0o755);
}

test('attach records only a committed, pushed canvas on the planning stage', async () => {
	const bin = join(root, '.bin');
	fakeTracker(bin);
	environment.PATH = `${bin}:${process.env.PATH}`;
	const git = (...args: string[]) =>
		run('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.test', ...args], { cwd: root });
	await git('init', '-q', '-b', 'feat/cards');
	await git('remote', 'add', 'origin', 'https://github.com/acme/atlas.git');
	const attach = () => design('attach', 'cards', '--item', 'abc123', '--stage', 'design');
	await git('commit', '-q', '--allow-empty', '-m', 'start');
	await expect(attach()).rejects.toThrow(/Commit designs\/cards/);
	await git('add', 'designs');
	await git('commit', '-q', '-m', 'cards');
	await expect(attach()).rejects.toThrow(/Push this commit/);
	await git('update-ref', 'refs/remotes/origin/feat/cards', 'HEAD');
	expect(await attach()).toBe('Attached cards to abc123 (2 pages).');
	expect(readFileSync(join(bin, 'call'), 'utf8')).toBe('artifact abc123 design\n');
	const artifact = JSON.parse(readFileSync(join(bin, 'artifact.json'), 'utf8'));
	expect(artifact.summary).toBe('Kept');
	expect(artifact.pages[0].links[0].url).toMatch(
		/^https:\/\/github\.com\/acme\/atlas\/blob\/[a-f0-9]{40}\/designs\/cards\/Wide\.html$/
	);
}, 60_000);
