import { existsSync, readdirSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterAll, beforeAll, expect, test } from 'vitest';
import {
	declaredOutput,
	snapshotAdditions
} from '../../src/adapters/snapshot-adapter/snapshotAdditions';

let root: string;
const tracked = new Set(['src/a.ts', 'package.json', 'packages/app/src/b.ts']);
const write = async (path: string): Promise<void> => {
	await mkdir(dirname(join(root, path)), { recursive: true });
	await writeFile(join(root, path), path);
};

beforeAll(async () => {
	root = await mkdtemp(join(tmpdir(), 'harness-additions-'));
	for (const path of tracked) await write(path);
});
afterAll(() => rm(root, { recursive: true, force: true }));

test('snapshotAdditions finds nothing in an untouched export', async () => {
	expect(await snapshotAdditions(root, { tracked, outputs: [], links: new Set() })).toEqual([]);
});

test('snapshotAdditions lists every untracked file outside declared outputs and links', async () => {
	const created = [
		'src/new.ts',
		'packages/app/src/deep/new.ts',
		'vitest.config.ts',
		'dist/cli.js',
		'packages/app/build/index.js',
		'report.tsbuildinfo',
		'distribution/extra.js'
	];
	for (const path of created) await write(path);
	await symlink(tmpdir(), join(root, 'node_modules'));
	await symlink(tmpdir(), join(root, 'src/linked'));
	const outputs = ['dist/', 'packages/app/build/', '*.tsbuildinfo'];
	const bounds = { tracked, outputs, links: new Set(['node_modules']) };
	expect(await snapshotAdditions(root, bounds)).toEqual([
		'distribution/extra.js',
		'packages/app/src/deep/new.ts',
		'src/linked',
		'src/new.ts',
		'vitest.config.ts'
	]);
	const undeclared = await snapshotAdditions(root, { tracked, outputs: [], links: new Set() });
	expect(undeclared).toEqual(expect.arrayContaining(['dist/cli.js', 'node_modules']));
});

test('declaredOutput matches a directory, a file and a pattern, never a sibling', () => {
	const outputs = ['dist/', 'coverage/lcov.info', '*.tsbuildinfo'];
	expect(declaredOutput('dist', outputs)).toBe(true);
	expect(declaredOutput('dist/cli.js', outputs)).toBe(true);
	expect(declaredOutput('coverage/lcov.info', outputs)).toBe(true);
	expect(declaredOutput('app.tsbuildinfo', outputs)).toBe(true);
	expect(declaredOutput('distribution', outputs)).toBe(false);
	expect(declaredOutput('coverage', outputs)).toBe(false);
	expect(declaredOutput('src/app.tsbuildinfo', outputs)).toBe(false);
});

const workspaces = readdirSync('packages').filter((name) =>
	existsSync(join('packages', name, 'package.json'))
);
test.each(workspaces)(
	'normal %s build and test outputs never exempt its source tree',
	async (workspace) => {
		const prefix = `packages/${workspace}/`;
		const created = [
			'node_modules/.vite/vitest/results.json',
			'.cache/run.json',
			'dist/index.js',
			'src/untracked.ts'
		];
		for (const path of created) await write(prefix + path);
		const { outputs } = JSON.parse(
			await readFile(new URL('../../harness.verify.json', import.meta.url), 'utf8')
		) as { outputs: string[] };
		expect(await snapshotAdditions(root, { tracked, outputs, links: new Set() }, prefix)).toEqual([
			prefix + 'src/untracked.ts'
		]);
	}
);
