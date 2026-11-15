import { afterEach, expect, test } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import helperExamples from '../specification/scenarios/helper-examples.json' with { type: 'json' };
import { unitExamplesScopes } from './unit-examples-verification-scopes';

const states = [
	{ id: 'first-state', title: 'first state is proved by its own test', coverage: 'required' },
	{ id: 'second-state', title: 'second state is proved by its own test', coverage: 'required' }
];
const rootRun = 'bun test/verification-output.ts vitest test/broken.test.ts';
const packageRun = 'bun ../../test/verification-output.ts vitest test/broken.test.ts';
const otherRun = 'bun test/other.ts vitest test/broken.test.ts';
const valid = examplesScenario('examples-broken', '.', rootRun);
const [command] = valid.tests;
const [first, second] = states;
const owned: string[] = [];

/** Each change breaks one rule of an otherwise valid examples scenario. */
const broken: Array<[string, Record<string, unknown>, string]> = [
	[
		'two tests',
		{ tests: [command, { ...command, id: 'second' }] },
		'must declare exactly one test'
	],
	['a ui kind', { kind: 'ui' }, 'kind must be headless'],
	[
		'a target that is not verification-output',
		{ tests: [{ ...command, target: otherRun }] },
		'the test target must be'
	],
	[
		'a package target at the root',
		{ tests: [{ ...command, target: packageRun }] },
		'the test target must be'
	],
	[
		'a runner other than command',
		{ tests: [{ ...command, runner: 'vitest' }] },
		'the test runner must be command'
	],
	[
		'an id that differs from the file name',
		{ id: 'examples-other' },
		'id "examples-other" must equal the file name without .json'
	],
	[
		'duplicate state titles',
		{ states: [first, { ...second, title: first.title }] },
		'state titles must be unique'
	]
];

afterEach(() => {
	for (const directory of owned.splice(0)) rmSync(directory, { recursive: true, force: true });
});

function temporaryRoot(): string {
	const root = mkdtempSync(join(tmpdir(), 'unit-examples-scopes-'));
	owned.push(root);
	return root;
}

/** A root whose specification/scenarios folder holds the named files, objects written as JSON. */
function rootWith(files: Record<string, unknown>): string {
	const root = temporaryRoot();
	const directory = join(root, 'specification', 'scenarios');
	mkdirSync(directory, { recursive: true });
	for (const [name, content] of Object.entries(files))
		writeFileSync(
			join(directory, name),
			typeof content === 'string' ? content : JSON.stringify(content)
		);
	return root;
}

/** helper-examples.json's shape, under its own id, states and one command. */
function examplesScenario(id: string, cwd: string, target: string) {
	const proofs = states.map((state) => state.id);
	return {
		...helperExamples,
		id,
		states,
		evidence: helperExamples.evidence.map((item) => ({ ...item, states: proofs })),
		tests: [{ ...helperExamples.tests[0], id, cwd, target }]
	};
}

test('each examples scenario scopes its own package and test file', () => {
	const root = rootWith({
		'examples-function-case.json': examplesScenario(
			'examples-function-case',
			'.',
			'bun test/verification-output.ts vitest test/function-case-examples.test.ts'
		),
		'examples-reports-chart.json': examplesScenario(
			'examples-reports-chart',
			'packages/reports',
			'bun ../../test/verification-output.ts vitest test/chart-examples.test.ts'
		)
	});
	const proofs = {
		'first state is proved by its own test': 'first-state',
		'second state is proved by its own test': 'second-state'
	};
	expect(unitExamplesScopes(root)).toEqual({
		'examples-function-case': {
			package: 'root',
			vitest: { 'test/function-case-examples.test.ts': proofs },
			playwright: {}
		},
		'examples-reports-chart': {
			package: 'reports',
			vitest: { 'test/chart-examples.test.ts': proofs },
			playwright: {}
		}
	});
});

test('files outside the examples pattern are never read as scopes', () => {
	const root = rootWith({
		'helper-examples.json': helperExamples,
		'examples.json': '{not json',
		'examples-notes.txt': 'not a scenario'
	});
	expect(unitExamplesScopes(root)).toEqual({});
});

test('an empty scenarios folder, or a root without one, has no examples scopes', () => {
	expect(unitExamplesScopes(rootWith({}))).toEqual({});
	expect(unitExamplesScopes(temporaryRoot())).toEqual({});
});

test.each(broken)('%s throws an error naming the file and the rule', (_label, change, rule) => {
	const root = rootWith({ 'examples-broken.json': { ...valid, ...change } });
	const path = join(root, 'specification', 'scenarios', 'examples-broken.json');
	expect(() => unitExamplesScopes(root)).toThrow(`${path}: ${rule}`);
});
