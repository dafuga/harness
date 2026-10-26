import { browserTestFiles } from '../development-tooling/browserTest';
import type { PlannedFile } from '../../core/development-tooling/files';
import { defaultUnitsConfig } from '../../core/development-tooling/unitsConfig';
import { stableJson } from '../../utils/development-tooling/stableJson';

const initialPageTest =
	"import { test } from './support/browserTest';\n\nconst viewports = [\n\t{ id: 'desktop', size: { width: 1440, height: 900 } },\n\t{ id: 'tablet', size: { width: 920, height: 800 } },\n\t{ id: 'mobile', size: { width: 390, height: 844 } }\n] as const;\n\nfor (const viewport of viewports) {\n\ttest.describe(viewport.id + ' viewport', () => {\n\t\ttest.use({ viewport: viewport.size });\n\t\ttest('app page initial state', async ({ page, matchScreenshot }) => {\n\t\t\tawait page.goto('/');\n\t\t\tawait matchScreenshot(page, 'initial-' + viewport.id + '.png', { fullPage: true });\n\t\t});\n\t});\n}\n";

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
	return {
		...unit('entry.index', 'src/index.ts', ['helloHarness']),
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
			states: ['default'],
			examples: [
				{
					subject: 'helloHarness',
					name: 'returns a greeting',
					call: 'helloHarness()',
					input: [],
					expected: { kind: 'value', value: 'hello from Harness' }
				}
			],
			cases: [
				{
					id: 'greeting.default',
					state: 'default',
					subject: 'helloHarness',
					example: 'returns a greeting',
					test: { file: 'test/index.test.ts', title: 'helloHarness: returns a greeting' }
				}
			]
		}
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
