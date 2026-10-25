import { expect, test } from 'vitest';
import type { ComponentManifest } from '../../../src/core/unitTypes';
import type { ContractCase } from '../../../src/services/verification-evidence/TestContractService';
import { TestCaseValidator } from '../../../src/validators/verification-evidence/TestCaseValidator';
import { indexFiles, unitOf } from '../../support/memoryTree';

const validator = new TestCaseValidator();
test('validate each allowed shape and its missing or invalid states', async () => {
	const unit = unitOf(
		await indexFiles({
			'src/utils/rank.ts': 'export function rank(value: number): number { return value; }'
		}),
		'function.rank'
	);
	const item = {
		id: 'rest',
		state: 'rest',
		subject: 'rank',
		test: { file: 'test/rank.test.ts', title: 'rank rest' },
		expected: { kind: 'value' as const, value: 1 }
	};
	const contract = { version: 1, shape: 'service', states: ['rest'], cases: [item] };
	expect(validator.validate(unit, contract).errors).toEqual([]);
	expect(validator.validate(unit, { ...contract, shape: 'smoke' }).valid).toBe(false);
	expect(validator.validate(unit, { ...contract, cases: [] }).valid).toBe(false);
	expect(validator.validate(unit, { ...contract, states: ['missing'] }).errors.join(' ')).toContain(
		'missing state'
	);
	expect(validator.validate(unit, { ...contract, shape: 'component' }).errors.join(' ')).toContain(
		'screenshot matching'
	);
	expect(
		validator.validate(unit, {
			...contract,
			shape: 'component',
			cases: [
				{ ...item, expected: { kind: 'screenshot', file: 'rank.png' }, viewports: ['desktop'] }
			]
		}).valid
	).toBe(true);
	expect(validator.validate(unit, { ...contract, shape: 'api' }).valid).toBe(false);
	expect(
		validator.validate(unit, {
			...contract,
			shape: 'api',
			cases: [{ ...item, expected: { kind: 'json', value: { rank: 1 } } }]
		}).valid
	).toBe(true);
	expect(validator.validate(unit, { ...contract, shape: 'helper' }).errors.join(' ')).toContain(
		'authored Examples'
	);
	assertAuthoredExampleCases(unit, item);
	assertMethodStateCases(unit, item);
	expect(
		validator.validate(unit, {
			...contract,
			cases: [{ ...item, test: { ...item.test, file: '../escape.test.ts' } }]
		}).valid
	).toBe(false);
});

function assertAuthoredExampleCases(unit: ComponentManifest, item: ContractCase) {
	const authored = {
		version: 1,
		states: ['rest'],
		shape: 'helper',
		examples: [
			{
				subject: 'rank',
				name: 'Identity',
				call: 'rank(1)',
				input: [1],
				expected: { kind: 'value' as const, value: 1 }
			}
		],
		cases: [{ ...item, example: 'Identity', test: { ...item.test, title: 'rank: Identity' } }]
	};
	expect(validator.validate(unit, authored).errors).toEqual([]);
	expect(
		validator
			.validate(unit, { ...authored, examples: [...authored.examples, ...authored.examples] })
			.errors.join(' ')
	).toContain('duplicate authored example');
}

function assertMethodStateCases(unit: ComponentManifest, item: ContractCase) {
	const owner = { ...unit, owns: { ...unit.owns, symbols: ['Runner.run', 'Runner.close'] } };
	const cases = ['Runner.run', 'Runner.close'].flatMap((subject) =>
		['ready', 'closed'].map((state) => ({
			...item,
			id: subject.toLowerCase() + '.' + state,
			subject,
			state,
			test: { ...item.test, title: subject + ' ' + state }
		}))
	);
	const contract = { version: 1, shape: 'service', states: ['ready', 'closed'], cases };
	expect(validator.validate(owner, contract).errors).toEqual([]);
	expect(
		validator
			.validate(owner, { ...contract, cases: [...cases, { ...cases[0], id: 'bug-only' }] })
			.errors.join(' ')
	).toContain('exactly one method/state');
	expect(
		validator
			.validate(owner, {
				...contract,
				cases: [...cases, { ...cases[0], id: 'orphan', subject: 'Runner.unknown' }]
			})
			.errors.join(' ')
	).toContain('unknown method');
	expect(
		validator.validate(owner, { ...contract, cases: cases.slice(1) }).errors.join(' ')
	).toContain('missing method/state');
}
