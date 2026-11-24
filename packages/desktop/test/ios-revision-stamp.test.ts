import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, expect, test } from 'vitest';
import { fileURLToPath } from 'node:url';

const project = fileURLToPath(new URL('../ios/App/App.xcodeproj/project.pbxproj', import.meta.url));
const plistBuddy = '/usr/libexec/PlistBuddy';
let directory: string;
let source: string;
let plist: string;

/** The Release-only revision stamp, read from the Xcode project so the test runs that exact script. */
function stampScript(): string {
	const converted = spawnSync('/usr/bin/plutil', ['-convert', 'json', '-o', '-', project], {
		encoding: 'utf8'
	});
	expect(converted.status, converted.stderr).toBe(0);
	const { objects } = JSON.parse(converted.stdout);
	const phase = Object.values(objects).find(
		(entry) => (entry as { name?: string }).name === 'Stamp Harness build revision'
	) as { shellScript: string };
	return phase.shellScript;
}

const git = (...args: string[]) =>
	execFileSync('git', args, { cwd: source, encoding: 'utf8' }).trim();

function stamp(configuration: string) {
	return spawnSync('/bin/sh', ['-c', stampScript()], {
		encoding: 'utf8',
		env: {
			PATH: process.env.PATH ?? '',
			CONFIGURATION: configuration,
			SRCROOT: source,
			TARGET_BUILD_DIR: directory,
			INFOPLIST_PATH: 'Info.plist'
		}
	});
}

/** The stamped revision, or null when the bundle has none. */
function revisionOf(): string | null {
	const printed = spawnSync(plistBuddy, ['-c', 'Print :HarnessBuildRevision', plist], {
		encoding: 'utf8',
		stdio: ['ignore', 'pipe', 'ignore']
	});
	return printed.status === 0 ? printed.stdout.trim() : null;
}

beforeEach(() => {
	directory = mkdtempSync(join(tmpdir(), 'harness-ios-stamp-'));
	source = mkdtempSync(join(tmpdir(), 'harness-ios-source-'));
	plist = join(directory, 'Info.plist');
	writeFileSync(
		plist,
		'<?xml version="1.0" encoding="UTF-8"?>\n<plist version="1.0"><dict><key>CFBundleName</key><string>Harness</string></dict></plist>\n'
	);
	execFileSync('git', ['init', '--quiet'], { cwd: source });
	git('config', 'user.email', 'stamp@example.invalid');
	git('config', 'user.name', 'Stamp Test');
	writeFileSync(join(source, 'tracked.txt'), 'one\n');
	git('add', 'tracked.txt');
	git('commit', '--quiet', '-m', 'initial');
});

afterEach(() => {
	rmSync(directory, { recursive: true, force: true });
	rmSync(source, { recursive: true, force: true });
});

test.runIf(process.platform === 'darwin')('a Debug build does not stamp the bundle', () => {
	expect(stamp('Debug').status).toBe(0);
	expect(revisionOf()).toBeNull();
});

test.runIf(process.platform === 'darwin')('a Release build stamps the exact commit', () => {
	const result = stamp('Release');
	expect(result.stderr).toBe('');
	expect(result.status).toBe(0);
	expect(revisionOf()).toBe(git('rev-parse', 'HEAD'));
});

test.runIf(process.platform === 'darwin')('a Release build refuses a modified tracked file', () => {
	writeFileSync(join(source, 'tracked.txt'), 'two\n');
	const result = stamp('Release');
	expect(result.status).not.toBe(0);
	expect(result.stderr).toContain('clean tracked worktree');
	expect(revisionOf()).toBeNull();
});
