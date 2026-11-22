import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { test } from 'vitest';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempDir } from '../support/temporary';
import { expect } from '../verificationExpect';

/**
 * scripts/package-website.ts exports nothing: it works when it runs, as the build runs it
 * (`bun scripts/package-website.ts`). Each test runs the real script under Bun in a temporary
 * project folder, since its paths are relative to the working directory, then reads back what the
 * folder holds. Bun.build rejects a failed bundle by default, so the branch that throws
 * ReportCliBundleError is reached only through a stub that resolves a result with success false.
 */

type Thrown = { name: string; code?: string; message: string; errors?: string[] };
type Run = { thrown?: Thrown };

const scriptPath = resolve(import.meta.dirname, '../../scripts/package-website.ts');
const meta = {
	unitId: 'script.package-website',
	symbol: 'package-website',
	evidence: 'examples-cases'
};
const consoleScript = 'globalThis.consoleReady = true;\n';
const consoleStyle = 'body { margin: 0; }\n';
const reportsBuild = { 'packages/reports/build/index.html': '<!doctype html>\n<title>Reports</title>\n' };
const cliEntry = { 'packages/reports/src/cli/index.ts': "console.log('report cli');\n" };
const consoleFiles = (js: string) => ({
	'packages/reports/dist/console/console.iife.js': js,
	'packages/reports/dist/console/console.css': consoleStyle
});
/** The project before the script runs, with an old file in dist/reports that the run must clear. */
const project = {
	...reportsBuild,
	...cliEntry,
	...consoleFiles(consoleScript),
	'dist/reports/stale.txt': 'left by an earlier run\n'
};
/** What dist/reports holds when the script stops after copying the two folders. */
const copiedOnly = [
	'dist/reports/build/index.html',
	'dist/reports/dist/console/console.css',
	'dist/reports/dist/console/console.iife.js'
];
const declaration = [
	"import type { ConsoleAssets } from './console';",
	'export declare const consoleAssets: ConsoleAssets;',
	''
].join('\n');
const consoleModule = (js: string) =>
	`export const consoleAssets = ${JSON.stringify({ script: js, style: consoleStyle })};\n`;
/** Stands in for Bun.build in the child process with a result whose success is false. */
const failedBuild = 'Bun.build = async () => ({ success: false, outputs: [], logs: [] });';
/** The child's program: it imports the script as the build does and prints what came back. */
const driverBody = `const run = await import(${JSON.stringify(scriptPath)}).then(
	() => ({}),
	(error) => ({
		thrown: {
			name: error?.name,
			code: error?.code,
			message: error?.message,
			errors: error?.errors?.map((item) => item.message)
		}
	})
);
console.log(JSON.stringify(run));`;

/** Runs the script in `root` under Bun, after `prelude`, and returns what its import gave back. */
function runPackaging(root: string, prelude = ''): Run {
	writeFileSync(join(root, 'run.mjs'), `${prelude}\n${driverBody}`);
	const child = spawnSync('bun', ['run.mjs'], { cwd: root, encoding: 'utf8', timeout: 10_000 });
	if (child.status !== 0) throw new Error(`The packaging child exited with status ${child.status}.`);
	return JSON.parse(child.stdout.trim().split('\n').at(-1) ?? '') as Run;
}

/** Writes files under `root`, creating their folders. */
function writeFiles(root: string, files: Record<string, string>): void {
	for (const [path, text] of Object.entries(files)) {
		mkdirSync(dirname(join(root, path)), { recursive: true });
		writeFileSync(join(root, path), text);
	}
}

/** Writes a project and the empty folders that the earlier build steps leave in dist. */
function writeProject(root: string, files: Record<string, string>): void {
	writeFiles(root, files);
	for (const folder of ['dist/api', 'dist/types/lib']) {
		mkdirSync(join(root, folder), { recursive: true });
	}
}

/** The files under a folder of the project, as paths from the project root, sorted. */
function filesUnder(root: string, folder: string): string[] {
	const base = join(root, folder);
	if (!existsSync(base)) return [];
	return readdirSync(base, { encoding: 'utf8', recursive: true })
		.filter((entry) => statSync(join(base, entry)).isFile())
		.map((entry) => `${folder}/${entry}`)
		.sort();
}

/** The text of a file of the project, or null when the script did not write it. */
function textOf(root: string, path: string): string | null {
	const file = join(root, path);
	return existsSync(file) ? readFileSync(file, 'utf8') : null;
}

/** What a run left in the project folder: the files under dist and the outputs the script writes. */
function leftBehind(root: string) {
	return {
		distFiles: filesUnder(root, 'dist'),
		cli: textOf(root, 'dist/reports/cli.js'),
		consoleUi: textOf(root, 'dist/api/console-ui.js'),
		declaration: textOf(root, 'dist/types/lib/console-ui.d.ts')
	};
}

/** Runs the script once in a new project folder holding `files`, then reads back what it left. */
function runFresh(files: Record<string, string>, prelude = '') {
	return withTempDir('package-website-', (root) => {
		writeProject(root, files);
		return { run: runPackaging(root, prelude), left: leftBehind(root) };
	});
}

test('Packaging cleared dist/reports, copied the reports build and dist folders, bundled the CLI and wrote the console-ui assets', async () => {
	const changed = {
		'packages/reports/dist/console/console.iife.js': "globalThis.consoleReady = 'v2';\n"
	};
	const { fresh, rerun } = await withTempDir('package-website-', (root) => {
		writeProject(root, project);
		const first = { run: runPackaging(root), left: leftBehind(root) };
		writeFiles(root, changed);
		return { fresh: first, rerun: { run: runPackaging(root), left: leftBehind(root) } };
	});
	expect(fresh.run).toEqual({});
	expect(fresh.left.distFiles).toEqual([
		'dist/api/console-ui.js',
		'dist/reports/build/index.html',
		'dist/reports/cli.js',
		'dist/reports/dist/console/console.css',
		'dist/reports/dist/console/console.iife.js',
		'dist/types/lib/console-ui.d.ts'
	]);
	expect(fresh.left.cli).toContain('console.log("report cli");');
	expect(fresh.left.consoleUi).toBe(consoleModule(consoleScript));
	expect(fresh.left.declaration).toBe(declaration);
	expect(rerun.run).toEqual({});
	expect(rerun.left.distFiles).toEqual(fresh.left.distFiles);
	expect(rerun.left.consoleUi).toBe(consoleModule("globalThis.consoleReady = 'v2';\n"));
	recordExampleCases(
		{
			...meta,
			state: 'packaging-cleared-dist-reports-copied-the-reports-build-and',
			file: 'packaging-cleared-dist-reports-copied-the-reports-build-and.json'
		},
		[
			{ name: 'a fresh build, with an old file in dist/reports', input: { files: project }, output: fresh.left },
			{
				name: 'a rerun after the console script changed, in the same folder',
				input: { files: changed },
				output: rerun.left
			}
		]
	);
});

test('A bundle result of success false threw ReportCliBundleError after the folders were copied and before the console assets were read', async () => {
	const { run, left } = await runFresh(project, failedBuild);
	expect(run).toEqual({
		thrown: { name: 'ReportCliBundleError', message: 'Report CLI bundle failed.' }
	});
	expect(left.distFiles).toEqual(copiedOnly);
	expect(left.cli).toBeNull();
	expect(left.consoleUi).toBeNull();
	expect(left.declaration).toBeNull();
	recordExampleCases(
		{
			...meta,
			state: 'a-bundle-result-of-success-false-threw-reportclibundleerror',
			file: 'a-bundle-result-of-success-false-threw-reportclibundleerror.json'
		},
		[
			{
				name: 'Bun.build stubbed to resolve success false, with the console files present',
				input: { files: project, buildResult: { success: false } },
				error: { ...run.thrown, ...left }
			}
		]
	);
});

test('A filesystem or Bun.build rejection propagated out unchanged, and no console-ui asset was written', async () => {
	const withoutBuild = { ...cliEntry, ...consoleFiles(consoleScript) };
	const brokenEntry = {
		...reportsBuild,
		...consoleFiles(consoleScript),
		'packages/reports/src/cli/index.ts': "import './missing-module';\n"
	};
	const copyFailed = await runFresh(withoutBuild);
	const bundleFailed = await runFresh(brokenEntry);
	expect(copyFailed.run).toEqual({
		thrown: {
			name: 'Error',
			code: 'ENOENT',
			message: "ENOENT: no such file or directory, lstat 'packages/reports/build'"
		}
	});
	expect(copyFailed.left.distFiles).toEqual([]);
	expect(copyFailed.left.consoleUi).toBeNull();
	expect(bundleFailed.run).toEqual({
		thrown: {
			name: 'AggregateError',
			message: 'Bundle failed',
			errors: ['Could not resolve: "./missing-module"']
		}
	});
	expect(bundleFailed.left.distFiles).toEqual(copiedOnly);
	expect(bundleFailed.left.consoleUi).toBeNull();
	recordExampleCases(
		{
			...meta,
			state: 'a-filesystem-or-bun-build-rejection-propagated-out-unchanged',
			file: 'a-filesystem-or-bun-build-rejection-propagated-out-unchanged.json'
		},
		[
			{
				name: 'no packages/reports/build folder to copy, so the first copy fails',
				input: { files: withoutBuild },
				error: { ...copyFailed.run.thrown, ...copyFailed.left }
			},
			{
				name: 'an entry that imports a module which does not exist, so Bun.build rejects',
				input: { files: brokenEntry },
				error: { ...bundleFailed.run.thrown, ...bundleFailed.left }
			}
		]
	);
});
