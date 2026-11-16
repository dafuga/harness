import { test } from 'vitest';
import type {
	AdapterCoverage,
	AuditResult
} from '../../src/audit/development-tooling/adapters/types';
import type { AuditFinding } from '../../src/audit/development-tooling/types';
import { renderAudit, renderAuditCoverage } from '../../src/audit/development-tooling/render';
import { recordExampleCases } from '../support/recordExampleCases';
import { expect } from '../verificationExpect';

/**
 * runAudit prints renderAudit(result.findings), or renderAuditCoverage(result) under --coverage.
 * Both only format text: they read no file, run no tool and take no environment, so no temporary
 * folder is needed. Each test calls its function with an example from the contract, or a variant
 * of one, asserts the exact text and records the cases of its state.
 */

const passedLine = 'Harness audit passed. Files and functions are staying small.';
const coverageHeader = 'Harness audit coverage (app profile)';

const profileCard: AuditFinding = {
	path: 'src/components/profileCard.tsx',
	rule: 'react-component-name',
	message: 'TSX/JSX component files should use PascalCase names.'
};
const orderService: AuditFinding = {
	path: 'src/services/OrderService.ts',
	rule: 'small-file',
	message: 'File has 512 lines. Limit is 220. Split it by responsibility.'
};
const cleanScript: AuditFinding = {
	path: 'scripts/clean.sh',
	rule: 'shell-unsafe-rm',
	message: 'Avoid broad rm -rf patterns.'
};

function typescriptAdapter(files: string[]): AdapterCoverage {
	return {
		id: 'typescript',
		label: 'TypeScript and JavaScript',
		files,
		extensions: ['.ts', '.tsx', '.js', '.jsx'],
		optionalTools: ['eslint']
	};
}
const svelte: AdapterCoverage = {
	id: 'svelte',
	label: 'Svelte',
	files: ['src/routes/+page.svelte', 'src/lib/Nav.svelte'],
	extensions: ['.svelte'],
	optionalTools: ['svelte-check', 'eslint']
};
const sql: AdapterCoverage = {
	id: 'sql',
	label: 'SQL',
	files: [],
	extensions: ['.sql'],
	optionalTools: ['sqlfluff']
};
const shell: AdapterCoverage = {
	id: 'shell',
	label: 'Shell',
	files: ['scripts/clean.sh', 'scripts/deploy.sh'],
	extensions: ['.sh'],
	optionalTools: ['shellcheck']
};
/** An adapter with no optional tools, as the real WASM adapter has. */
const wasm: AdapterCoverage = {
	id: 'wasm',
	label: 'WASM artifacts',
	files: ['artifacts/token.wasm', 'artifacts/token.abi'],
	extensions: ['.abi', '.wasm'],
	optionalTools: []
};

const cleanAdapters = [
	typescriptAdapter(['src/lib/format.ts', 'src/lib/money.ts']),
	svelte,
	sql,
	shell
];
const findingsAdapters = [
	typescriptAdapter(['src/services/OrderService.ts', 'src/components/profileCard.tsx']),
	svelte,
	sql,
	shell
];

/** The contract's first coverage example: no findings, no ignored findings, no unknown files. */
const cleanApp: AuditResult = {
	findings: [],
	coverage: {
		profile: 'app',
		adapters: cleanAdapters,
		coveredFiles: cleanAdapters.flatMap((adapter) => adapter.files),
		ignoredPaths: ['.svelte-kit/', 'node_modules/'],
		ignoredFindings: [],
		unknownFiles: []
	}
};

/** The contract's second coverage example: two findings, one ignored finding, one unknown file. */
const findingsApp: AuditResult = {
	findings: [orderService, cleanScript],
	coverage: {
		profile: 'app',
		adapters: findingsAdapters,
		coveredFiles: findingsAdapters.flatMap((adapter) => adapter.files),
		ignoredPaths: ['node_modules/'],
		ignoredFindings: [profileCard],
		unknownFiles: ['tools/release.py']
	}
};

/** cleanApp with the WASM adapter added and no ignored paths. */
const wasmApp: AuditResult = {
	...cleanApp,
	coverage: { ...cleanApp.coverage, adapters: [...cleanAdapters, wasm], ignoredPaths: [] }
};

/** findingsApp with a clean code report attached and an empty covered file list. */
const findingsWithCleanCode: AuditResult = {
	...findingsApp,
	cleanCode: {
		mode: 'advisory',
		status: 'not-applicable',
		rubricVersion: 'clean-code-v1',
		requestedModel: 'claude-haiku-5-5',
		minConfidence: 0.8,
		coverage: { selectedFiles: [], excludedPaths: [], unsupportedFiles: [] },
		files: [],
		usage: { input_tokens: 0, output_tokens: 0 }
	},
	coverage: { ...findingsApp.coverage, coveredFiles: [] }
};

const adapterLines = [
	'Covered adapters:',
	'- typescript: 2 files (.ts, .tsx, .js, .jsx) tools: eslint',
	'- svelte: 2 files (.svelte) tools: svelte-check, eslint',
	'- sql: 0 files (.sql) tools: sqlfluff',
	'- shell: 2 files (.sh) tools: shellcheck'
];
const cleanText = [
	passedLine,
	coverageHeader,
	...adapterLines,
	'Ignored findings: none',
	'Unknown files: none',
	'Ignored paths:',
	'- .svelte-kit/',
	'- node_modules/'
].join('\n');
const findingsText = [
	'src/services/OrderService.ts [small-file]',
	'  File has 512 lines. Limit is 220. Split it by responsibility.',
	'',
	'scripts/clean.sh [shell-unsafe-rm]',
	'  Avoid broad rm -rf patterns.',
	coverageHeader,
	...adapterLines,
	'Ignored findings: 1',
	'Unknown files:',
	'- tools/release.py',
	'Ignored paths:',
	'- node_modules/'
].join('\n');
const wasmText = [
	passedLine,
	coverageHeader,
	...adapterLines,
	'- wasm: 2 files (.abi, .wasm)',
	'Ignored findings: none',
	'Unknown files: none',
	'Ignored paths: none'
].join('\n');

test('renderAudit printed the passed line or each finding in order, with a blank line between findings', () => {
	const cases = [
		{ name: 'no findings print the passed line', input: [] },
		{ name: 'one finding prints its path and rule, then its message below', input: [profileCard] },
		{
			name: 'two findings print in the order given, one blank line apart',
			input: [orderService, cleanScript]
		},
		{
			name: 'the same two findings reversed print in the reversed order',
			input: [cleanScript, orderService]
		}
	].map((testCase) => ({ ...testCase, output: renderAudit(testCase.input) }));
	const [none, one, two, reversed] = cases;
	expect(none.output).toBe(passedLine);
	expect(one.output).toBe(
		'src/components/profileCard.tsx [react-component-name]\n  TSX/JSX component files should use PascalCase names.'
	);
	expect(two.output).toBe(
		'src/services/OrderService.ts [small-file]\n  File has 512 lines. Limit is 220. Split it by responsibility.\n\nscripts/clean.sh [shell-unsafe-rm]\n  Avoid broad rm -rf patterns.'
	);
	expect(reversed.output).toBe(
		'scripts/clean.sh [shell-unsafe-rm]\n  Avoid broad rm -rf patterns.\n\nsrc/services/OrderService.ts [small-file]\n  File has 512 lines. Limit is 220. Split it by responsibility.'
	);
	expect(two.output.endsWith('\n')).toBe(false);
	recordExampleCases(
		{
			unitId: 'audit.render',
			symbol: 'renderAudit',
			state: 'renderaudit-printed-the-passed-line-or-each-finding-in-order',
			evidence: 'examples-cases',
			file: 'renderaudit-printed-the-passed-line-or-each-finding-in-order.json'
		},
		cases
	);
});

test('renderAuditCoverage printed findings and the coverage report: adapters, counts, unknown files and ignored paths, with none for empty lists', () => {
	const cases = [
		{ name: 'a clean app run prints the passed line, the adapters and none', input: cleanApp },
		{
			name: 'findings, an ignored finding and an unknown file print in the report',
			input: findingsApp
		},
		{ name: 'an adapter with no optional tools and no ignored paths prints none', input: wasmApp },
		{
			name: 'a clean code report and an empty covered file list change nothing',
			input: findingsWithCleanCode
		}
	].map((testCase) => ({ ...testCase, output: renderAuditCoverage(testCase.input) }));
	const [clean, withFindings, withWasm, withCleanCode] = cases;
	expect(clean.output).toBe(cleanText);
	expect(withFindings.output).toBe(findingsText);
	expect(withWasm.output).toBe(wasmText);
	expect(withCleanCode.output).toBe(withFindings.output);
	recordExampleCases(
		{
			unitId: 'audit.render',
			symbol: 'renderAuditCoverage',
			state: 'renderauditcoverage-printed-findings-and-the-coverage-report',
			evidence: 'examples-cases',
			file: 'renderauditcoverage-printed-findings-and-the-coverage-report.json'
		},
		cases
	);
});
