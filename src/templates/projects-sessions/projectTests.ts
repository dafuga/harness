import { browserTestFiles } from '../development-tooling/browserTest';
import type { PlannedFile } from '../../core/development-tooling/files';
import { defaultUnitsConfig } from '../../core/development-tooling/unitsConfig';
import { defaultVerifyConfig } from '../../core/verification-evidence/verifyTypes';
import { stableJson } from '../../utils/development-tooling/stableJson';

const initialPageTest =
	"import { test } from './support/browserTest';\n\nconst viewports = [\n\t{ id: 'desktop', size: { width: 1440, height: 900 } },\n\t{ id: 'tablet', size: { width: 920, height: 800 } },\n\t{ id: 'mobile', size: { width: 390, height: 844 } }\n] as const;\n\nfor (const viewport of viewports) {\n\ttest.describe(viewport.id + ' viewport', () => {\n\t\ttest.use({ viewport: viewport.size });\n\t\ttest('app page initial state', async ({ page, matchScreenshot }) => {\n\t\t\tawait page.goto('/');\n\t\t\tawait matchScreenshot(page, 'initial-' + viewport.id + '.png', { fullPage: true });\n\t\t});\n\t});\n}\n";

const libraryCaseReporter =
	"import { appendFileSync, mkdirSync, realpathSync } from 'node:fs';\nimport { join, relative } from 'node:path';\n\nexport default class HarnessCaseReporter {\n\tonFinished(files) {\n\t\tfor (const file of files) this.tasks(file.tasks ?? [], file.filepath ?? '', []);\n\t}\n\ttasks(tasks, file, titles) {\n\t\tfor (const task of tasks) {\n\t\t\tconst path = [...titles, task.name];\n\t\t\tif (task.type === 'suite') this.tasks(task.tasks ?? [], file, path);\n\t\t\telse {\n\t\t\t\tconst retries = task.result?.retryCount ?? 0;\n\t\t\t\tfor (let retry = 0; retry < retries; retry++)\n\t\t\t\t\tthis.write(file, path.join(' > '), 'failed', retry);\n\t\t\t\tthis.write(file, path.join(' > '), task.result?.state ?? task.mode ?? 'skip', retries);\n\t\t\t}\n\t\t}\n\t}\n\twrite(file, title, state, retry) {\n\t\tconst {\n\t\t\tHARNESS_VERIFY_CASE_ROOT: root,\n\t\t\tHARNESS_EVIDENCE_DIR: directory,\n\t\t\tHARNESS_VERIFY_REVISION: revision\n\t\t} = process.env;\n\t\tif (!root || !directory || !revision) return;\n\t\tconst path = casePath(root, file);\n\t\tif (path === '..' || path.startsWith('../')) return;\n\t\tif (\n\t\t\t!/^[a-f0-9]{40}$/.test(revision) ||\n\t\t\t!path ||\n\t\t\t!title ||\n\t\t\t!Number.isInteger(retry) ||\n\t\t\tretry < 0\n\t\t)\n\t\t\tthrow new Error('Invalid case outcome');\n\t\tconst status = ['pass', 'passed'].includes(state)\n\t\t\t? 'passed'\n\t\t\t: ['skip', 'skipped', 'todo'].includes(state)\n\t\t\t\t? 'skipped'\n\t\t\t\t: 'failed';\n\t\tmkdirSync(directory, { recursive: true });\n\t\tappendFileSync(\n\t\t\tjoin(directory, 'case-results.ndjson'),\n\t\t\tJSON.stringify({ file: path, title, revision, retry, status }) + '\\n'\n\t\t);\n\t}\n}\n\nfunction casePath(root, file) {\n\ttry {\n\t\treturn relative(realpathSync(root), realpathSync(file)).replaceAll('\\\\', '/');\n\t} catch (error) {\n\t\tif (!['ENOENT', 'ENOTDIR'].includes(error?.code)) throw error;\n\t\treturn relative(root, file).replaceAll('\\\\', '/');\n\t}\n}\n";
const libraryVitestConfig =
	"import { defineConfig } from 'vitest/config';\nimport HarnessCaseReporter from './test/support/harnessCaseReporter.js';\nexport default defineConfig({ test: { reporters: ['default', new HarnessCaseReporter()] } });\n";

export function appTestFiles(): PlannedFile[] {
	return [
		...browserTestFiles(),
		{
			path: 'tests/e2e/app.spec.ts',
			contents: initialPageTest
		}
	];
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
