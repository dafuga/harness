import { expect, test } from 'vitest';
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
});
