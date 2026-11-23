import type {
	Reader,
	ExampleCase,
	IdentityContract
} from './command.development-tooling-contracts-command-read-contract-snapshot.test.types';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'vitest';
import { createContractHistoryReader } from '../../src/commands/development-tooling/contracts-command/readContractSnapshot';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempRepo } from '../support/temporary';
import type { TemporaryRepo } from '../support/temporary.types';
import { expect } from '../verificationExpect';

function writeContract(repo: TemporaryRepo, name: string, contract: unknown): string {
	const path = join(repo.root, 'specification', 'units', `${name}.json`);
	const raw = JSON.stringify(contract, null, 2);
	mkdirSync(dirname(path), { recursive: true });
	writeFileSync(path, raw);
	return raw;
}

async function readFailure(reader: Reader): Promise<{ name: string; message: string }> {
	try {
		await reader.read('working-tree');
	} catch (error) {
		if (!(error instanceof Error)) throw error;
		return { name: error.name, message: error.message };
	}
	throw new Error('Expected the contract snapshot to be rejected');
}

async function missingIdentityCase(repo: TemporaryRepo, reader: Reader): Promise<ExampleCase> {
	const contract = { kind: 'command', responsibility: 'No identity is present.' };
	const name = 'command.missing-id';
	writeContract(repo, name, contract);
	const error = await readFailure(reader);
	expect(error.name).toBe('ExpectedCliError');
	expect(error.message).toContain('nonempty id');
	rmSync(join(repo.root, 'specification', 'units', `${name}.json`));
	return {
		name: 'Rejects a JSON unit with no id',
		input: {
			root: '<temporary Git worktree>',
			revision: 'working-tree',
			files: [{ path: `specification/units/${name}.json`, contract }]
		},
		error
	};
}

async function duplicateIdentityCase(
	repo: TemporaryRepo,
	reader: Reader,
	contracts: [IdentityContract, IdentityContract],
	identity: 'id' | 'uid'
): Promise<ExampleCase> {
	const names = ['command.first', 'command.second'];
	contracts.forEach((contract, index) => writeContract(repo, names[index], contract));
	const error = await readFailure(reader);
	expect(error.name).toBe('ExpectedCliError');
	expect(error.message).toContain('Duplicate contract identity');
	return {
		name: `Rejects two JSON units with the same ${identity}`,
		input: {
			root: '<temporary Git worktree>',
			revision: 'working-tree',
			files: contracts.map((contract, index) => ({
				path: `specification/units/${names[index]}.json`,
				contract
			}))
		},
		error
	};
}

test('reads the working tree contract snapshot', async () => {
	await withTempRepo(async (repo) => {
		const contract = {
			id: 'command.read-example',
			uid: 'u_readexample',
			kind: 'command',
			responsibility: 'Reads a made-up report option.',
			owns: { source: ['src/commands/reports/readExample.ts'] }
		};
		const raw = writeContract(repo, 'command.read-example', contract);
		const reader = await createContractHistoryReader(repo.root);
		const snapshot = await reader.read('working-tree');
		const expected = [
			{
				id: contract.id,
				uid: contract.uid,
				kind: contract.kind,
				contractPath: 'specification/units/command.read-example.json',
				sourcePaths: ['src/commands/reports/readExample.ts'],
				raw,
				data: contract
			}
		];

		expect(snapshot).toEqual(expected);
		recordExampleCases(
			{
				unitId: 'command.development-tooling-contracts-command-read-contract-snapshot',
				symbol: 'createContractHistoryReader',
				state: 'reads-the-working-tree-contract-snapshot',
				evidence: 'examples-cases',
				file: 'reads-the-working-tree-contract-snapshot.json'
			},
			[
				{
					name: 'Reads raw JSON and its source declaration from the worktree',
					input: {
						root: '<temporary Git worktree>',
						revision: 'working-tree',
						contractPath: 'specification/units/command.read-example.json',
						contract
					},
					output: snapshot
				}
			]
		);
	});
});

test('rejects malformed contract JSON', async () => {
	await withTempRepo(async (repo) => {
		const relativePath = 'specification/units/command.malformed.json';
		const path = join(repo.root, relativePath);
		const raw = '{"id":';
		mkdirSync(dirname(path), { recursive: true });
		writeFileSync(path, raw);
		const reader = await createContractHistoryReader(repo.root);
		const error = await readFailure(reader);
		expect(error.name).toBe('ExpectedCliError');
		expect(error.message).toContain(`Cannot read JSON contract ${relativePath}`);
		recordExampleCases(
			{
				unitId: 'command.development-tooling-contracts-command-read-contract-snapshot',
				symbol: 'createContractHistoryReader',
				state: 'rejects-malformed-contract-json',
				evidence: 'examples-cases',
				file: 'rejects-malformed-contract-json.json'
			},
			[
				{
					name: 'Rejects malformed unit JSON with its contract path',
					input: {
						root: '<temporary Git worktree>',
						revision: 'working-tree',
						file: { path: relativePath, raw }
					},
					error
				}
			]
		);
	});
});

test('rejects missing and duplicate contract identities', async () => {
	await withTempRepo(async (repo) => {
		const reader = await createContractHistoryReader(repo.root);
		const cases = [
			await missingIdentityCase(repo, reader),
			await duplicateIdentityCase(
				repo,
				reader,
				[
					{ id: 'command.duplicate', uid: 'u_duplicate_a', kind: 'command' },
					{ id: 'command.duplicate', uid: 'u_duplicate_b', kind: 'command' }
				],
				'id'
			),
			await duplicateIdentityCase(
				repo,
				reader,
				[
					{ id: 'command.first', uid: 'u_duplicate', kind: 'command' },
					{ id: 'command.second', uid: 'u_duplicate', kind: 'command' }
				],
				'uid'
			)
		];
		expect(cases.map(({ error }) => (error as { name: string }).name)).toEqual([
			'ExpectedCliError',
			'ExpectedCliError',
			'ExpectedCliError'
		]);

		recordExampleCases(
			{
				unitId: 'command.development-tooling-contracts-command-read-contract-snapshot',
				symbol: 'createContractHistoryReader',
				state: 'rejects-missing-and-duplicate-contract-identities',
				evidence: 'examples-cases',
				file: 'rejects-missing-and-duplicate-contract-identities.json'
			},
			cases
		);
	});
});
