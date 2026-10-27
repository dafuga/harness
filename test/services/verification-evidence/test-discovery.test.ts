import { expect, test } from 'vitest';
import { TestDiscoveryService } from '../../../src/services/verification-evidence/TestDiscoveryService';
import { measureWorkload } from '../../support/measureWorkload';

const service = new TestDiscoveryService();
test('scan initialized source finds imported cases, aliases and computed registration', async () => {
	const found = service.scan(
		`import { test as check } from 'vitest'; check('ready', () => {}); check.skip('missing', () => {}); check.each([1, 2])('row %i', () => {}); check.fails('expected failure', () => {});`,
		'test/service.test.ts'
	);
	expect(found.map((item) => [item.title, item.dynamic, item.disabled])).toEqual([
		['ready', false, false],
		['missing', false, true],
		['row %i', true, false],
		['expected failure', false, true]
	]);
	expect(service.scan(`const test = () => {}; test('ordinary call');`, 'src/service.ts')).toEqual(
		[]
	);
	const nested = service.scan(
		`import { test } from 'vitest';
		test.describe('active', () => { test('ready', () => {}); });
		test.describe.skip('disabled', () => {
			test.describe('inner', () => { test('ready', () => {}); });
		});`,
		'test/nested.test.ts'
	);
	expect(nested.map(({ title, disabled }) => [title, disabled])).toEqual([
		['active > ready', false],
		['disabled > inner > ready', true]
	]);
	await measureWorkload(
		'service.verification-evidence-test-discovery',
		'parameterized-modifiers',
		() => assertParameterizedCases(service)
	);
});

function assertParameterizedCases(subject: TestDiscoveryService): void {
	const found = subject.scan(
		`import { test as check } from 'vitest';
		check.each(['beta.function.only'])('data-only', () => {});
		check.each(['data.describe'])('data-describe', () => {});
		check.each(['data.use'])('data-use', () => {});
		check.each(['data.fails'])('data-fails', () => {});
		check.skip.each(['data.only'])('explicit-skip', () => {});
		check['only']('bracket-only', () => {});
		check[modifier]('unknown-modifier', () => {});`,
		'test/parameters.test.ts'
	);
	expect(
		found.map(({ title, dynamic, disabled }) => [title, dynamic, disabled]),
		'parameter data is not a runner modifier'
	).toEqual([
		['data-only', true, false],
		['data-describe', true, false],
		['data-use', true, false],
		['data-fails', true, false],
		['explicit-skip', true, true],
		['bracket-only', false, true],
		['unknown-modifier', true, false]
	]);
}

test('discover initialized and unreadable sources retain explicit discovery gaps', async () => {
	const manifest = await discoveryManifest();
	const tree = {
		read: async (file: string) => {
			if (file === 'missing') throw new Error('missing');
			if (file === 'test/method-unit.json')
				return JSON.stringify({
					...manifest,
					testing: {
						...manifest.testing,
						shape: 'service',
						cases: [
							{
								...manifest.testing.cases[0],
								test: { file: 'test/methods.test.ts', title: 'Runner.finish initialized' },
								expected: { kind: 'void' }
							}
						]
					}
				});
			if (file === 'test/methods.test.ts')
				return `import { test } from 'vitest'; import unit from './method-unit.json'; new TestExpectationService().registerCases(test, unit, 'test/methods.test.ts', {});`;
			if (file === 'test/unit.json') return JSON.stringify(manifest);
			if (file === 'test/examples.test.ts')
				return `import { test } from 'vitest'; import unit from './unit.json'; new TestExpectationService().registerExamples(test, unit, { finish: () => undefined });`;
			return `import { test } from 'vitest'; test.each([1])('row %i', () => {});`;
		}
	};
	const result = await service.discover(tree, [
		'present',
		'missing',
		'test/examples.test.ts',
		'test/methods.test.ts'
	]);
	expect(result.tests).toHaveLength(3);
	expect(result.tests[2]).toMatchObject({
		title: 'Runner.finish initialized',
		file: 'test/methods.test.ts',
		dynamic: false
	});
	expect(result.tests[1]).toMatchObject({
		title: 'finish: Finish',
		dynamic: false,
		disabled: false
	});
	expect(result.errors).toEqual([
		'Cannot read test declarations: missing',
		'present:1: computed case requires runner discovery'
	]);
	await measureWorkload(
		'service.verification-evidence-test-discovery',
		'registration-contexts',
		() => assertRegistrationContexts(service, tree.read)
	);
});

async function assertRegistrationContexts(
	subject: TestDiscoveryService,
	read: (file: string) => Promise<string>
) {
	const rows = [
		{ code: 'registerExamples(test.skip, unit, {})', title: 'finish: Finish', disabled: true },
		{ code: "registerExamples(test['only'], unit, {})", title: 'finish: Finish', disabled: true },
		{
			code: "registerCases(test.skip, unit, 'test/methods.test.ts', {})",
			title: 'Runner.finish initialized',
			disabled: true,
			method: true
		},
		{
			code: "describe.skip('disabled', () => { service.registerExamples(test, unit, {}); })",
			title: 'disabled > finish: Finish',
			disabled: true,
			suite: true
		},
		{
			code: "describe('active', () => { service.registerExamples(test, unit, {}); })",
			title: 'active > finish: Finish',
			suite: true
		},
		{ code: 'registerExamples(test[modifier], unit, {})', title: 'finish: Finish', dynamic: true },
		{
			code: 'if (condition) service.registerExamples(test, unit, {})',
			title: 'finish: Finish',
			dynamic: true,
			suite: true
		},
		{
			code: 'function later() { service.registerExamples(test, unit, {}); }',
			title: 'finish: Finish',
			dynamic: true,
			suite: true
		}
	];
	for (const row of rows) {
		const file = row.method ? 'test/methods.test.ts' : 'test/examples.test.ts';
		const manifest = row.method ? './method-unit.json' : './unit.json';
		const registration = row.suite ? row.code : `service.${row.code};`;
		const source = `import { test, describe } from 'vitest'; import unit from '${manifest}'; ${registration}`;
		const found = await subject.discover(
			{ read: (path) => (path === file ? Promise.resolve(source) : read(path)) },
			[file]
		);
		expect(
			found.tests.map(({ title, disabled, dynamic }) => ({ title, disabled, dynamic })),
			row.code
		).toEqual([
			{ title: row.title, disabled: Boolean(row.disabled), dynamic: Boolean(row.dynamic) }
		]);
		const error = row.disabled ? 'skipped, exclusive' : row.dynamic ? 'computed case' : undefined;
		if (error) expect(found.errors.join(' '), row.code).toContain(error);
		else expect(found.errors, row.code).toEqual([]);
	}
}

async function discoveryManifest() {
	const original = (await import('../../../specification/units/function.case.json')).default;
	return {
		...original,
		helperContracts: [],
		testing: {
			version: 1,
			shape: 'helper',
			states: ['initialized'],
			examples: [
				{
					subject: 'finish',
					name: 'Finish',
					call: 'finish()',
					input: [],
					expected: { kind: 'void' }
				}
			],
			cases: [
				{
					id: 'finish',
					state: 'initialized',
					subject: 'finish',
					example: 'Finish',
					test: { file: 'test/examples.test.ts', title: 'finish: Finish' }
				}
			]
		}
	};
}
