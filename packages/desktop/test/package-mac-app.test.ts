import { afterAll, beforeAll, expect, test } from 'vitest';
import { execFileSync } from 'node:child_process';
import {
	lstatSync,
	mkdirSync,
	mkdtempSync,
	readdirSync,
	readFileSync,
	realpathSync,
	rmSync,
	writeFileSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { assembleMacApp } from '../scripts/package-mac-app';

const mac = process.platform === 'darwin';
let root = '';
let app = '';

beforeAll(async () => {
	if (!mac) return;
	root = realpathSync(mkdtempSync(join(tmpdir(), 'harness-packaged-app-')));
	app = join(root, 'Harness.app');
	const bundles = join(root, 'bundles');
	const renderer = join(root, 'renderer');
	mkdirSync(renderer);
	writeFileSync(join(renderer, 'index.html'), '<p>fixture renderer</p>');
	const builder = resolve(import.meta.dirname, 'package-mac-app-probe.build.ts');
	execFileSync('bun', [builder, bundles], { stdio: 'inherit' });
	await assembleMacApp(app, { bundles, renderer, revision: 'c'.repeat(40) });
}, 180_000);

afterAll(() => {
	if (root) rmSync(root, { recursive: true, force: true });
});

function plistValue(key: string): string {
	const plist = join(app, 'Contents/Info.plist');
	return execFileSync('/usr/libexec/PlistBuddy', ['-c', `Print :${key}`, plist], {
		encoding: 'utf8'
	}).trim();
}

/** Every file and directory in the bundle that group or others may write. */
function writableByOthers(directory: string): string[] {
	return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
		if (entry.isSymbolicLink()) return [];
		const path = join(directory, entry.name);
		const own = (lstatSync(path).mode & 0o022) === 0 ? [] : [path.slice(app.length + 1)];
		return entry.isDirectory() ? [...own, ...writableByOthers(path)] : own;
	});
}

test.runIf(mac)(
	'the packaged app is packaged to Electron, starts the bundled Tracker and renders',
	() => {
		const executable = plistValue('CFBundleExecutable');
		const report = join(root, 'report.json');
		const home = join(root, 'home');
		mkdirSync(home);
		execFileSync(
			join(app, 'Contents/MacOS', executable),
			[`--user-data-dir=${join(root, 'profile')}`],
			{
				env: { HOME: home, PATH: process.env.PATH, HARNESS_PROBE_REPORT: report },
				stdio: 'inherit',
				timeout: 60_000
			}
		);
		const project = join(app, 'Contents/Resources/app');
		expect(JSON.parse(readFileSync(report, 'utf8'))).toEqual({
			isPackaged: true,
			appPath: project,
			started: project,
			rendered: 'probe'
		});
		expect(executable).toBe('Harness');
		expect(readdirSync(join(app, 'Contents/MacOS'))).toEqual(['Harness']);
	},
	90_000
);

test.runIf(mac)('nothing in the packaged app is writable by group or others', () => {
	expect(writableByOthers(app)).toEqual([]);
});
