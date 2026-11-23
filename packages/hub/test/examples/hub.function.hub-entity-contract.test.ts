import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { hubEntityContract } from '../../src/routes/api/[...path]/hub-projection-service/hubEntityContract';

type UnitArg = NonNullable<Parameters<typeof hubEntityContract>[0]>;
type PlanArg = NonNullable<Parameters<typeof hubEntityContract>[1]>;

const fileNameUnit: UnitArg = {
	contract: {
		origin: 'declared',
		inputs: [
			{
				name: 'value',
				type: 'string',
				required: true,
				description:
					'File name checked against letters, digits, dot, underscore and hyphen, starting with a letter or digit, at most 200 characters, with no ".." sequence.'
			}
		],
		outputs: [
			{ name: 'hubFile', type: 'string', description: 'The same file name, returned unchanged.' }
		],
		errors: [
			{
				name: 'Error',
				type: 'thrown',
				description:
					'Thrown with code invalid-path when the name fails the pattern or contains "..".'
			}
		],
		errorStatus: 'declared'
	}
};

const rowsPlan: PlanArg = {
	contract: {
		inputs: [
			{
				name: 'rows',
				type: 'EvidenceRow[]',
				required: true,
				description: 'Evidence rows, drawn in the order given.'
			}
		],
		outputs: [{ name: 'EvidenceGrid', type: 'JSX.Element', description: 'The rendered grid.' }],
		errors: [],
		hash: 'c0a4e7f19b3d2a86e5f0c4b7d1a9e2f83c6b5d4a7e1f0c9b8a7d6e5f4c3b2a10'
	}
};

const unitId = 'hub.function.hub-entity-contract';

test('Prefers the plan contract over the unit contract', async () => {
	const result = await hubEntityContract(fileNameUnit, rowsPlan);

	expect(result).toBe(rowsPlan.contract);
	recordExampleCases(
		{
			unitId,
			symbol: 'hubEntityContract',
			state: 'prefers-the-plan-contract-over-the-unit-contract',
			evidence: 'examples-cases',
			file: 'prefers-the-plan-contract-over-the-unit-contract.json'
		},
		[
			{
				name: 'plan is given together with a unit',
				input: { unit: 'file-name contract', plan: 'rows contract' },
				output: rowsPlan.contract
			}
		]
	);
});

test('Hashes the unit contract and adds a hash field', async () => {
	const result = await hubEntityContract(fileNameUnit);
	const repeated = await hubEntityContract(fileNameUnit);

	expect(result).toMatchObject(fileNameUnit.contract ?? {});
	expect(result.hash).toMatch(/^[0-9a-f]{64}$/);
	expect(repeated.hash).toBe(result.hash);
	recordExampleCases(
		{
			unitId,
			symbol: 'hubEntityContract',
			state: 'hashes-the-unit-contract-and-adds-a-hash-field',
			evidence: 'examples-cases',
			file: 'hashes-the-unit-contract-and-adds-a-hash-field.json'
		},
		[
			{
				name: 'declared file-name contract without a plan',
				input: { unit: 'file-name contract' },
				output: result
			}
		]
	);
});

test('Returns an empty contract when nothing is given', async () => {
	const result = await hubEntityContract();

	expect(result).toEqual({ inputs: [], outputs: [], errors: [], hash: null });
	recordExampleCases(
		{
			unitId,
			symbol: 'hubEntityContract',
			state: 'returns-an-empty-contract-when-nothing-is-given',
			evidence: 'examples-cases',
			file: 'returns-an-empty-contract-when-nothing-is-given.json'
		},
		[{ name: 'neither plan nor unit is given', input: {}, output: result }]
	);
});

test('Rejects when the unit contract holds a BigInt', async () => {
	const bigUnit = {
		contract: { ...fileNameUnit.contract, version: BigInt(1) }
	} as unknown as UnitArg;

	await expect(hubEntityContract(bigUnit)).rejects.toThrow(TypeError);
	recordExampleCases(
		{
			unitId,
			symbol: 'hubEntityContract',
			state: 'rejects-when-the-unit-contract-holds-a-bigint',
			evidence: 'examples-cases',
			file: 'rejects-when-the-unit-contract-holds-a-bigint.json'
		},
		[
			{
				name: 'unit contract carries a BigInt field',
				input: { unit: 'file-name contract with a bigint version' },
				error: 'TypeError'
			}
		]
	);
});
