import { ESLint } from 'eslint';
import { format } from 'prettier';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import type { PlannedFile } from '../../../src/core/development-tooling/files';
import { builtinModules } from '../../../src/templates/module-system/builtinModules';
import { expect } from '../../verificationExpect';
import { measureWorkload } from '../measureWorkload';
import { runCommand } from '../cli';
import { assertComposableBrowserReport } from '../browserBaselineResults';

/** Generated Playwright cases retain their declared title, retries and actual outcome. */
export async function assertGeneratedBrowserOutcome(project: PlannedFile[]): Promise<void> {
	const config = project.find((file) => file.path === 'playwright.config.ts')?.contents ?? '';
	expect(config, 'Generated app must install its Playwright case reporter').toContain(
		'./test/support/harnessCaseReporter.js'
	);
	const source = project.find(
		(file) => file.path === 'test/support/harnessCaseReporter.js'
	)?.contents;
	expect(source, 'Generated app must emit its Playwright case reporter').toBeDefined();
	const root = await mkdtemp(join(tmpdir(), 'harness-browser-case-result-'));
	const names = ['HARNESS_VERIFY_CASE_ROOT', 'HARNESS_EVIDENCE_DIR', 'HARNESS_VERIFY_REVISION'];
	const previous = names.map((name) => process.env[name]);
	try {
		const snapshot = join(root, 'snapshot');
		const directory = join(root, 'evidence');
		const file = join(snapshot, 'tests/e2e/app.spec.ts');
		await mkdir(dirname(file), { recursive: true });
		await writeFile(file, '');
		await assertComposableBrowserReport(snapshot, config);
		await symlink(snapshot, join(root, 'snapshot-alias'), 'dir');
		const reporterFile = join(root, 'reporter.mjs');
		await writeFile(reporterFile, source!);
		process.env.HARNESS_VERIFY_CASE_ROOT = join(root, 'snapshot-alias');
		process.env.HARNESS_EVIDENCE_DIR = directory;
		process.env.HARNESS_VERIFY_REVISION = 'a'.repeat(40);
		const { default: Reporter } = await import(pathToFileURL(reporterFile).href);
		const reporter = new Reporter();
		const test = {
			location: { file },
			titlePath: () => ['', 'chromium', 'app.spec.ts', 'desktop viewport', 'app page initial state']
		};
		for (const [status, retry] of [
			['failed', 0],
			['passed', 1],
			['skipped', 0],
			['timedOut', 0]
		] as const)
			reporter.onTestEnd(test, { status, retry });
		await expectBrowserOutcomes(directory);
	} finally {
		for (const [index, name] of names.entries()) {
			if (previous[index] === undefined) delete process.env[name];
			else process.env[name] = previous[index];
		}
		await rm(root, { recursive: true, force: true });
	}
}

async function expectBrowserOutcomes(directory: string): Promise<void> {
	const outcomes = (await readFile(join(directory, 'case-results.ndjson'), 'utf8'))
		.trim()
		.split('\n')
		.map((line) => JSON.parse(line));
	expect(outcomes).toEqual(
		[
			['failed', 0],
			['passed', 1],
			['skipped', 0],
			['failed', 0]
		].map(([status, retry]) => ({
			file: 'tests/e2e/app.spec.ts',
			title: 'desktop viewport > app page initial state',
			revision: 'a'.repeat(40),
			retry,
			status
		}))
	);
}

/** The generated case must fail when its authored Example expects a different result. */
export async function assertAuthoredLibraryResult(project: string): Promise<void> {
	const path = join(project, 'specification/units/entry.index.json');
	const original = await readFile(path, 'utf8');
	const evidence = await mkdtemp(join(tmpdir(), 'harness-library-case-result-'));
	const revision = 'a'.repeat(40);
	const alias = join(evidence, 'project-alias');
	await symlink(project, alias, 'dir');
	const env = {
		HARNESS_VERIFY_CASE_ROOT: alias,
		HARNESS_EVIDENCE_DIR: evidence,
		HARNESS_VERIFY_REVISION: revision
	};
	try {
		const manifest = JSON.parse(original);
		manifest.testing.examples[0].expected.value = 'changed authored greeting';
		await writeFile(path, JSON.stringify(manifest, null, '\t') + '\n');
		const changed = await runCommand(
			['bun', 'run', 'test:unit', 'test/index.test.ts'],
			project,
			false,
			env
		);
		expect(changed.exitCode).toBe(1);
		expect(changed.stdout + changed.stderr).toContain('changed authored greeting');
		await expectLibraryOutcome(evidence, revision, 'failed');
		await rm(join(evidence, 'case-results.ndjson'));
		await writeFile(path, original);
		const restored = await runCommand(
			['bun', 'run', 'test:unit', 'test/index.test.ts'],
			project,
			false,
			env
		);
		expect(restored.exitCode).toBe(0);
		await expectLibraryOutcome(evidence, revision, 'passed');
	} finally {
		await writeFile(path, original);
		await rm(evidence, { recursive: true, force: true });
	}
}

async function expectLibraryOutcome(directory: string, revision: string, status: string) {
	const file = join(directory, 'case-results.ndjson');
	expect(existsSync(file), 'Generated library runner must record its executed example').toBe(true);
	const lines = (await readFile(file, 'utf8'))
		.trim()
		.split('\n')
		.map((line) => JSON.parse(line));
	expect(lines).toEqual([
		{
			file: 'test/index.test.ts',
			title: 'helloHarness: returns a greeting',
			revision,
			retry: 0,
			status
		}
	]);
}

/** Validate real emitted foundations with generated lint rules in a minimal typed source project. */
export async function assertFoundationLint(project: PlannedFile[], kind: string): Promise<void> {
	const root = await mkdtemp(join(tmpdir(), 'harness-foundation-lint-'));
	try {
		const sources = await writeProject(root, project);
		const eslint = new ESLint({
			cwd: root,
			overrideConfigFile: join(root, 'eslint.config.js'),
			overrideConfig: { languageOptions: { parserOptions: { tsconfigRootDir: root } } }
		});
		const results = await measureWorkload(
			'template.module-system-browser-testing-files',
			`lint-${kind}-testing-foundations`,
			() =>
				measureWorkload(
					'template.module-system-audio-testing-files',
					`lint-${kind}-testing-foundations`,
					() => eslint.lintFiles(sources)
				)
		);
		expect(
			results.flatMap((result) =>
				result.messages
					.filter((message) => message.severity === 2)
					.map((message) => ({
						file: relative(root, result.filePath),
						rule: message.ruleId,
						message: message.message
					}))
			),
			'Generated testing foundations satisfy their project lint rules'
		).toEqual([]);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
}

async function writeProject(root: string, project: PlannedFile[]): Promise<string[]> {
	const foundations = builtinModules
		.filter((module) => module.testing)
		.flatMap((module) => module.setup)
		.filter((file) => file.path.startsWith('src/'));
	const options = JSON.parse(project.find((file) => file.path === '.prettierrc')!.contents);
	const config = project.filter((file) =>
		['package.json', 'eslint.config.js', 'eslint.harness-rules.js', 'harness.audit.json'].includes(
			file.path
		)
	);
	const files = [
		...config,
		...foundations,
		{
			path: 'tsconfig.json',
			contents: JSON.stringify({
				compilerOptions: {
					target: 'ES2022',
					module: 'ESNext',
					moduleResolution: 'Bundler',
					strict: true,
					skipLibCheck: true
				},
				include: ['src/**/*.ts']
			})
		}
	];
	await symlink(resolve('node_modules'), join(root, 'node_modules'), 'dir');
	for (const file of files) {
		await mkdir(dirname(join(root, file.path)), { recursive: true });
		await writeFile(
			join(root, file.path),
			await format(file.contents, { ...options, filepath: file.path })
		);
	}
	return foundations.map((file) => join(root, file.path));
}
