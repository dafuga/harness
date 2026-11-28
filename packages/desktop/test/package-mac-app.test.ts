import { afterAll, beforeAll, expect, test } from 'vitest';
import { execFileSync } from 'node:child_process';
import {
	chmodSync,
	lstatSync,
	mkdirSync,
	mkdtempSync,
	readdirSync,
	readFileSync,
	realpathSync,
	renameSync,
	rmSync,
	writeFileSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import {
	assembleMacApp,
	deviceApprovalBinary,
	verifyMacAppLayout
} from '../scripts/package-mac-app';

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

/** Launches the assembled app and returns what its probe main process observed. */
function launch(name: string, args: string[]) {
	const report = join(root, `${name}.json`);
	const home = join(root, `${name}-home`);
	mkdirSync(home);
	execFileSync(join(app, 'Contents/MacOS', plistValue('CFBundleExecutable')), args, {
		env: {
			HOME: home,
			PATH: process.env.PATH,
			HARNESS_PROBE_PROFILE: join(root, `${name}-profile`),
			HARNESS_PROBE_REPORT: report
		},
		stdio: 'inherit',
		timeout: 60_000
	});
	return JSON.parse(readFileSync(report, 'utf8'));
}

test.runIf(mac)(
	'the packaged app is packaged to Electron, starts the bundled Tracker and renders',
	() => {
		const project = join(app, 'Contents/Resources/app');
		expect(launch('installed', [])).toEqual({
			isPackaged: true,
			appPath: project,
			started: project,
			rendered: 'probe'
		});
		expect(plistValue('CFBundleExecutable')).toBe('Harness');
		expect(readdirSync(join(app, 'Contents/MacOS'))).toEqual(['Harness']);
	},
	90_000
);

test.runIf(mac)(
	'a launch with an isolated profile leaves the Mac Tracker alone',
	() => {
		const isolated = launch('isolated', [`--user-data-dir=${join(root, 'isolated-profile')}`]);
		expect(isolated).toMatchObject({ isPackaged: true, started: null, rendered: 'probe' });
	},
	90_000
);

test.runIf(mac)('nothing in the packaged app is writable by group or others', () => {
	expect(writableByOthers(app)).toEqual([]);
});

test.runIf(mac)('release verification refuses either defect when it returns', () => {
	expect(() => verifyMacAppLayout(app)).not.toThrow();

	const helper = join(app, 'Contents/Helpers/harness');
	chmodSync(helper, 0o777);
	expect(() => verifyMacAppLayout(app)).toThrow(/writable by group or others: .*Helpers.harness/);
	chmodSync(helper, 0o755);

	const plist = join(app, 'Contents/Info.plist');
	const setExecutable = (name: string) =>
		execFileSync('/usr/libexec/PlistBuddy', ['-c', `Set :CFBundleExecutable ${name}`, plist]);
	setExecutable('Electron');
	expect(() => verifyMacAppLayout(app)).toThrow(/must be named Harness/);
	setExecutable('Harness');

	const executable = join(app, 'Contents/MacOS/Harness');
	renameSync(executable, join(app, 'Contents/MacOS/Electron'));
	expect(() => verifyMacAppLayout(app)).toThrow(/missing its Harness executable/);
	renameSync(join(app, 'Contents/MacOS/Electron'), executable);
	expect(() => verifyMacAppLayout(app)).not.toThrow();
});

test.runIf(mac)(
	'the packaged approval helper refuses a command before the private login handshake',
	() => {
		const helper = join(app, deviceApprovalBinary);
		expect(execFileSync(helper, ['--version'], { encoding: 'utf8', timeout: 5000 }).trim()).toBe(
			'1'
		);
		const reply = execFileSync(helper, [], {
			input: JSON.stringify({ action: 'list' }) + '\n',
			encoding: 'utf8',
			timeout: 5000
		});
		expect(JSON.parse(reply)).toEqual({ error: 'request-refused' });
	}
);
