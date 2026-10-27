import { browserTestFiles } from '../development-tooling/browserTest';
import type { PlannedFile } from '../../core/development-tooling/files';
import { defaultUnitsConfig } from '../../core/development-tooling/unitsConfig';
import { defaultVerifyConfig } from '../../core/verification-evidence/verifyTypes';
import { stableJson } from '../../utils/development-tooling/stableJson';

const appViewports = [
	{ id: 'desktop', width: 1440, height: 900 },
	{ id: 'tablet', width: 920, height: 800 },
	{ id: 'mobile', width: 390, height: 844 }
] as const;
const viewportRows = appViewports
	.map(({ id, width, height }) => `\t{ id: '${id}', size: { width: ${width}, height: ${height} } }`)
	.join(',\n');
const initialPageTest =
	`import { test } from './support/browserTest';\n\nconst viewports = [\n${viewportRows}\n] as const;\n\n` +
	appViewports
		.map(
			({ id }, index) =>
				`test.describe('${id} viewport', () => {\n\tconst viewport = viewports[${index}];\n\ttest.use({ viewport: viewport.size });\n\ttest('app page initial state', async ({ page, matchScreenshot }) => {\n\t\tawait page.goto('/');\n\t\tawait matchScreenshot(page, 'initial-' + viewport.id + '.png', { fullPage: true });\n\t});\n});`
		)
		.join('\n\n') +
	'\n';
const libraryCaseReporter =
	"import { appendFileSync, mkdirSync, realpathSync } from 'node:fs';\nimport { join, relative } from 'node:path';\n\nexport default class HarnessCaseReporter {\n\tonTestEnd(test, result) {\n\t\tthis.write(\n\t\t\ttest.location.file,\n\t\t\ttest.titlePath().slice(3).join(' > '),\n\t\t\tresult.status,\n\t\t\tresult.retry\n\t\t);\n\t}\n\tonFinished(files) {\n\t\tfor (const file of files) this.tasks(file.tasks ?? [], file.filepath ?? '', []);\n\t}\n\ttasks(tasks, file, titles) {\n\t\tfor (const task of tasks) {\n\t\t\tconst path = [...titles, task.name];\n\t\t\tif (task.type === 'suite') this.tasks(task.tasks ?? [], file, path);\n\t\t\telse {\n\t\t\t\tconst retries = task.result?.retryCount ?? 0;\n\t\t\t\tfor (let retry = 0; retry < retries; retry++)\n\t\t\t\t\tthis.write(file, path.join(' > '), 'failed', retry);\n\t\t\t\tthis.write(file, path.join(' > '), task.result?.state ?? task.mode ?? 'skip', retries);\n\t\t\t}\n\t\t}\n\t}\n\twrite(file, title, state, retry) {\n\t\tconst {\n\t\t\tHARNESS_VERIFY_CASE_ROOT: root,\n\t\t\tHARNESS_EVIDENCE_DIR: directory,\n\t\t\tHARNESS_VERIFY_REVISION: revision\n\t\t} = process.env;\n\t\tif (!root || !directory || !revision) return;\n\t\tconst path = casePath(root, file);\n\t\tif (path === '..' || path.startsWith('../')) return;\n\t\tif (\n\t\t\t!/^[a-f0-9]{40}$/.test(revision) ||\n\t\t\t!path ||\n\t\t\t!title ||\n\t\t\t!Number.isInteger(retry) ||\n\t\t\tretry < 0\n\t\t)\n\t\t\tthrow new Error('Invalid case outcome');\n\t\tconst status = ['pass', 'passed'].includes(state)\n\t\t\t? 'passed'\n\t\t\t: ['skip', 'skipped', 'todo'].includes(state)\n\t\t\t\t? 'skipped'\n\t\t\t\t: 'failed';\n\t\tmkdirSync(directory, { recursive: true });\n\t\tappendFileSync(\n\t\t\tjoin(directory, 'case-results.ndjson'),\n\t\t\tJSON.stringify({ file: path, title, revision, retry, status }) + '\\n'\n\t\t);\n\t}\n}\n\nfunction casePath(root, file) {\n\ttry {\n\t\treturn relative(realpathSync(root), realpathSync(file)).replaceAll('\\\\', '/');\n\t} catch (error) {\n\t\tif (!['ENOENT', 'ENOTDIR'].includes(error?.code)) throw error;\n\t\treturn relative(root, file).replaceAll('\\\\', '/');\n\t}\n}\n";
const libraryVitestConfig =
	"import { defineConfig } from 'vitest/config';\nimport HarnessCaseReporter from './test/support/harnessCaseReporter.js';\nexport default defineConfig({ test: { reporters: ['default', new HarnessCaseReporter()] } });\n";

export function appTestFiles(): PlannedFile[] {
	return [
		...browserTestFiles(),
		{ path: 'test/support/harnessCaseReporter.js', contents: libraryCaseReporter },
		{ path: 'harness.units.json', contents: stableJson({ ...defaultUnitsConfig, testing: 1 }) },
		{ path: 'harness.verify.json', contents: stableJson(appVerifyConfig()) },
		{ path: 'specification/units/page.root.json', contents: stableJson(initialPageUnit()) },
		{
			path: 'specification/scenarios/initial-page.json',
			contents: stableJson(initialPageScenario())
		},
		{
			path: 'tests/e2e/app.spec.ts',
			contents: initialPageTest
		}
	];
}

function initialPageCases() {
	return appViewports.map(({ id }) => ({
		id: `default.${id}`,
		state: 'default',
		viewports: [id],
		test: { file: 'tests/e2e/app.spec.ts', title: `${id} viewport > app page initial state` },
		expected: {
			kind: 'screenshot',
			file: `.cache/harness/visual-baselines/app.spec.ts/initial-${id}.png`
		}
	}));
}

function initialPageUnit() {
	return {
		schemaVersion: 1,
		id: 'page.root',
		kind: 'page',
		title: '/',
		responsibility: 'Owns the / route page.',
		responsibilityOrigin: 'derived',
		status: 'active',
		composition: { level: 'page', uses: ['component.atoms-html-h1'] },
		owns: { source: ['src/routes/+page.svelte'], symbols: ['+page'] },
		contract: {
			origin: 'derived',
			inputs: [],
			outputs: [{ name: '+page', type: 'markup' }],
			errors: []
		},
		dependencies: [{ unit: 'component.atoms-html-h1', via: 'import', origin: 'derived' }],
		runtime: {
			kind: 'module',
			entry: 'src/routes/+page.svelte',
			targets: [{ kind: 'module', entry: 'src/routes/+page.svelte' }]
		},
		scenarios: ['initial-page'],
		testing: { version: 1, shape: 'page', states: ['default'], cases: initialPageCases() },
		budgets: { size: 'frozen', complexity: 'frozen', performance: [] }
	};
}

function initialPageScenario() {
	return {
		schemaVersion: 1,
		id: 'initial-page',
		title: 'Initial page',
		kind: 'ui',
		units: ['page.root'],
		states: [{ id: 'default', title: 'Default', coverage: 'required' }],
		viewports: appViewports,
		tests: [
			{
				id: 'page',
				kind: 'e2e',
				runner: 'playwright',
				target: 'tests/e2e/app.spec.ts',
				cases: initialPageCases().map(({ id }) => ({ unit: 'page.root', case: id }))
			}
		],
		evidence: [
			{
				id: 'screens',
				kind: 'screenshot',
				states: ['default'],
				viewports: appViewports.map(({ id }) => id),
				provenance: 'actual-capture',
				build: 'app',
				capture: 'full-page',
				required: true
			}
		]
	};
}

function appVerifyConfig() {
	return {
		...defaultVerifyConfig,
		setup: [{ command: 'bun run build' }],
		link: ['node_modules'],
		outputs: [
			'.cache/',
			'.svelte-kit/',
			'build/',
			'node_modules/',
			'playwright-report/',
			'test-results/'
		],
		builds: [{ id: 'app', directory: '.svelte-kit/output' }]
	};
}

/** The initial library case reads the same authored expectation shown by entity documentation. */
export function libTestFiles(): PlannedFile[] {
	return [
		{ path: 'harness.units.json', contents: stableJson({ ...defaultUnitsConfig, testing: 1 }) },
		{
			path: 'harness.verify.json',
			contents: stableJson({ ...defaultVerifyConfig, link: ['node_modules'] })
		},
		{ path: 'vitest.config.ts', contents: libraryVitestConfig },
		{ path: 'test/support/harnessCaseReporter.js', contents: libraryCaseReporter },
		{ path: 'specification/units/entry.index.json', contents: stableJson(libraryEntry()) },
		{ path: 'specification/units/script.harness-audit.json', contents: stableJson(auditEntry()) },
		{
			path: 'test/index.test.ts',
			contents:
				"import { expect, test } from 'vitest';\nimport { helloHarness } from '../src';\nimport unit from '../specification/units/entry.index.json';\n\ntest('helloHarness: returns a greeting', () => {\n\texpect(helloHarness()).toEqual(unit.testing.examples[0].expected.value);\n});\n"
		}
	];
}

function libraryEntry() {
	const { budgets, ...entry } = unit('entry.index', 'src/index.ts', ['helloHarness']);
	return {
		...entry,
		responsibility: 'Exports the initial library greeting.',
		responsibilityOrigin: 'declared',
		contract: {
			origin: 'declared',
			inputs: [],
			outputs: [{ name: 'helloHarness', type: 'string', description: 'The library greeting.' }],
			errors: []
		},
		testing: {
			version: 1,
			shape: 'helper',
			examples: [
				{
					subject: 'helloHarness',
					name: 'returns a greeting',
					call: 'helloHarness()',
					input: [],
					expected: { kind: 'value', value: 'hello from Harness' }
				}
			],
			states: ['default'],
			cases: [
				{
					id: 'greeting.default',
					state: 'default',
					subject: 'helloHarness',
					example: 'returns a greeting',
					test: { file: 'test/index.test.ts', title: 'helloHarness: returns a greeting' }
				}
			]
		},
		budgets
	};
}

function auditEntry() {
	return unit('script.harness-audit', 'scripts/harness-audit.ts', []);
}

function unit(id: 'entry.index' | 'script.harness-audit', entry: string, symbols: string[]) {
	return {
		schemaVersion: 1,
		id,
		kind: id === 'entry.index' ? 'entry' : 'script',
		title: id === 'entry.index' ? 'index' : 'harness-audit',
		responsibility: 'Owns the harness-audit build or maintenance script.',
		responsibilityOrigin: 'derived',
		status: 'active',
		owns: { source: [entry], symbols },
		contract: { origin: 'derived', inputs: [], outputs: [], errors: [] },
		dependencies: [],
		runtime: { kind: 'module', entry, targets: [{ kind: 'module', entry }] },
		scenarios: [],
		budgets: { size: 'frozen', complexity: 'frozen', performance: [] }
	};
}
