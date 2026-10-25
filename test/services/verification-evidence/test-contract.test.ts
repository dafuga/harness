import { expect, test } from 'vitest';
import type { ComponentManifest } from '../../../src/core/unitTypes';
import { TestContractService } from '../../../src/services/verification-evidence/TestContractService';
import { indexFiles, unitOf } from '../../support/memoryTree';

const service = new TestContractService();
async function fixture() {
	const unit = unitOf(
		await indexFiles({
			'src/utils/rank.ts': 'export function rank(value: number): number { return value; }'
		}),
		'function.rank'
	);
	return {
		...unit,
		testing: {
			version: 1 as const,
			shape: 'api' as const,
			states: ['ready'],
			cases: [
				{
					id: 'ready',
					state: 'ready',
					test: { file: 'test/rank.test.ts', title: 'rank ready' },
					expected: { kind: 'json' as const, value: { value: 1 } }
				}
			]
		}
	};
}

test('validate initialized and invalid registries against declared cases', async () => {
	const unit = await fixture();
	const registry = {
		units: [unit],
		scenarios: [],
		files: new Set(['test/rank.test.ts']),
		tests: [{ file: 'test/rank.test.ts', title: 'rank ready' }],
		required: true
	};
	expect(service.validate(registry)).toEqual([]);
	expect(service.validate({ ...registry, files: new Set() }).join(' ')).toContain('missing test');
	expect(service.validate({ ...registry, tests: [] }).join(' ')).toContain('not discovered');
	expect(
		service
			.validate({
				...registry,
				tests: [...registry.tests, { file: 'test/extra.test.ts', title: 'one-off bug' }]
			})
			.join(' ')
	).toContain('Unsupported or orphaned');
	expect(
		service.validate({ ...registry, units: [{ ...unit, testing: undefined }] }).join(' ')
	).toContain('missing standardized');
	const duplicated = {
		...unit,
		testing: { ...unit.testing, cases: [unit.testing.cases[0], unit.testing.cases[0]] }
	};
	expect(service.validate({ ...registry, units: [duplicated] }).join(' ')).toContain(
		'duplicate case'
	);
	assertExecutedCases(registry);
});

test('compare initialized contracts preserves identities unless capabilities change', async () => {
	const unit = await fixture();
	const changed = {
		...unit,
		testing: {
			...unit.testing,
			cases: [...unit.testing.cases, { ...unit.testing.cases[0], id: 'bug-123' }]
		}
	};
	expect(service.compare([unit], [changed]).join(' ')).toContain('case identities/count changed');
	const documented = {
		...changed,
		contract: {
			...changed.contract,
			origin: 'declared' as const,
			inputs: changed.contract.inputs.map((item) => ({
				...item,
				description: 'Clarified existing input'
			}))
		}
	};
	expect(service.compare([unit], [documented]).join(' ')).toContain(
		'case identities/count changed'
	);
	const reordered = {
		...changed,
		owns: { ...changed.owns, symbols: [...changed.owns.symbols].reverse() }
	};
	expect(service.compare([unit], [reordered]).join(' ')).toContain('case identities/count changed');
	expect(
		service.compare(
			[unit],
			[
				{
					...unit,
					testing: {
						...unit.testing,
						cases: [{ ...unit.testing.cases[0], expected: { kind: 'json', value: { value: 2 } } }]
					}
				}
			]
		)
	).toEqual([]);
	expect(
		service.compare(
			[unit],
			[{ ...changed, testing: { ...changed.testing, states: ['ready', 'error'] } }]
		)
	).toEqual([]);
	expect(service.compare([], [unit])).toEqual([]);
	assertSiblingCaseIdentity(unit);
});

function assertSiblingCaseIdentity(unit: ComponentManifest) {
	const names = ['first', 'second'];
	const helpers = names.map((name) => ({
		name,
		source: 'src/helpers/strings/values.ts',
		pure: true as const,
		inputs: [],
		output: 'number',
		consumers: [{ unit: 'function.a' }, { unit: 'function.b' }],
		examples: [{ name: 'Base', call: `${name}()`, input: [], output: 0 }]
	}));
	const cases = names.map((subject) => ({
		id: `${subject}.base`,
		state: 'ready',
		subject,
		example: 'Base',
		test: { file: 'test/values.test.ts', title: `${subject}: Base` }
	}));
	const before = {
		...unit,
		owns: { ...unit.owns, symbols: names },
		helperContracts: helpers,
		testing: { version: 1 as const, shape: 'helper' as const, states: ['ready'], cases }
	};
	const after = {
		...before,
		helperContracts: [
			{
				...helpers[0],
				examples: [
					...helpers[0].examples,
					{ name: 'New first capability', call: 'first(1)', input: [1], output: 1 }
				]
			},
			helpers[1]
		],
		testing: {
			...before.testing,
			cases: [
				{
					...cases[0],
					id: 'first.new',
					example: 'New first capability',
					test: { ...cases[0].test, title: 'first: New first capability' }
				},
				cases[0],
				{ ...cases[1], id: 'second.renamed' }
			]
		}
	};
	expect(
		service.compare([before], [after]).join(' '),
		'changing first must not permit changing second case identities'
	).toContain('second');
}

function assertExecutedCases(registry: Parameters<TestContractService['validate']>[0]) {
	const revision = 'a'.repeat(40);
	const outcome = {
		file: 'test/rank.test.ts',
		title: 'rank ready',
		revision,
		retry: 0,
		status: 'passed' as 'passed' | 'failed' | 'skipped'
	};
	const run = (outcomes: (typeof outcome)[]) =>
		service.validate({
			...registry,
			...{ execution: { revision, files: [outcome.file], outcomes } }
		});
	expect(run([outcome])).toEqual([]);
	expect(run([]).join(' ')).toContain('missing executed case');
	expect(run([outcome, outcome]).join(' ')).toContain('duplicate executed case');
	expect(run([{ ...outcome, title: 'unregistered bug' }]).join(' ')).toContain(
		'unsupported executed case'
	);
	expect(run([{ ...outcome, revision: 'b'.repeat(40) }]).join(' ')).toContain('wrong revision');
	expect(run([{ ...outcome, status: 'skipped' }]).join(' ')).toContain('did not pass');
	for (const changed of [
		{ ...outcome, retry: -1 },
		{ ...outcome, file: '../escape.test.ts' },
		{ ...outcome, status: 'unknown' as never }
	])
		expect(run([changed]).join(' ')).toContain('invalid executed case');
	expect(
		run([
			{ ...outcome, status: 'failed' },
			{ ...outcome, retry: 1 }
		])
	).toEqual([]);
}
