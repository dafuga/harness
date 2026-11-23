import { commitContract } from './command.development-tooling-contracts-command-contract-history-identity.fixture';

import { test } from 'vitest';
import {
	currentContractIdentity,
	selectContractIdentity
} from '../../src/commands/development-tooling/contracts-command/contractHistoryIdentity';
import { createContractHistoryReader } from '../../src/commands/development-tooling/contracts-command/readContractSnapshot';
import type {
	ContractHistoryIdentity,
	ContractLogContext,
	StoredContract
} from '../../src/commands/development-tooling/contracts-command/contractHistory.types';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempRepo } from '../support/temporary';
import type { TemporaryRepo } from '../support/temporary.types';
import { expect } from '../verificationExpect';

const unitId = 'command.development-tooling-contracts-command-contract-history-identity';

function summarizeIdentity(identity: ContractHistoryIdentity | undefined): unknown {
	if (!identity) return null;
	return {
		...(identity.uid ? { uid: identity.uid } : {}),
		aliases: [...identity.aliases].sort(),
		legacy: [...identity.legacy].sort(),
		pending: identity.pending
	};
}

function storedContract(id: string, uid?: string): StoredContract {
	const data = { id, ...(uid ? { uid } : {}), kind: 'command' };
	return {
		id,
		...(uid ? { uid } : {}),
		kind: 'command',
		contractPath: `specification/units/${id}.json`,
		sourcePaths: [`src/commands/${id}.ts`],
		raw: JSON.stringify(data),
		data
	};
}

test('Seeds stable identity from committed HEAD', () => withTempRepo(seedStableIdentityExample));

async function seedStableIdentityExample(repo: TemporaryRepo): Promise<void> {
	const id = 'command.example-contract';
	const uid = 'u_examplecontract';
	commitContract(repo, id, uid);
	const reader = await createContractHistoryReader(repo.root);
	const byId = await currentContractIdentity(reader, id);
	const byUid = await currentContractIdentity(reader, uid);
	const emptyQuery = await currentContractIdentity(reader, '');

	expect(byId).toEqual({ uid, aliases: new Set([id]), legacy: new Set(), pending: false });
	expect(byUid).toEqual(byId);
	expect(emptyQuery).toBeUndefined();
	recordExampleCases(
		{
			unitId,
			symbol: 'currentContractIdentity',
			state: 'seeds-stable-identity-from-committed-head',
			evidence: 'examples-cases',
			file: 'seeds-stable-identity-from-committed-head.json'
		},
		[
			{
				name: 'Seeds the selected stable identity by unit id',
				input: { root: '<temporary Git repository>', unit: id },
				output: summarizeIdentity(byId)
			},
			{
				name: 'Finds the same committed identity by stable uid',
				input: { root: '<temporary Git repository>', unit: uid },
				output: summarizeIdentity(byUid)
			},
			{
				name: 'Leaves an empty unit query unselected',
				input: { root: '<temporary Git repository>', unit: '' },
				output: summarizeIdentity(emptyQuery)
			}
		]
	);
}

test('Tracks uid aliases and excludes reused ids', () => withTempRepo(trackIdentityAliasesExample));

test('Throws Error when the committed snapshot read fails', () =>
	withTempRepo(snapshotReadFailureExample));

async function snapshotReadFailureExample(repo: TemporaryRepo): Promise<void> {
	commitContract(repo, 'command.example-contract', 'u_examplecontract');
	const reader = await createContractHistoryReader(repo.root);
	const diagnostic = 'snapshot unavailable';
	reader.read = async () => {
		throw new Error(diagnostic);
	};
	await expect(currentContractIdentity(reader, 'command.example-contract')).rejects.toThrow(
		diagnostic
	);
	recordExampleCases(
		{
			unitId,
			symbol: 'currentContractIdentity',
			state: 'throws-error-when-the-committed-snapshot-read-fails',
			evidence: 'examples-cases',
			file: 'throws-error-when-the-committed-snapshot-read-fails.json'
		},
		[
			{
				name: 'Propagates the committed snapshot diagnostic',
				input: { unit: 'command.example-contract', failure: diagnostic },
				error: { name: 'Error', message: diagnostic }
			}
		]
	);
}

async function trackIdentityAliasesExample(repo: TemporaryRepo): Promise<void> {
	const uid = 'u_selectedcontract';
	commitContract(repo, 'command.new-contract-id', uid);
	const reader = await createContractHistoryReader(repo.root);
	const identity = await currentContractIdentity(reader, uid);
	expect(identity).toBeDefined();
	const context = identityContext(reader, repo, uid, identity);
	const before = [
		storedContract('command.legacy-id'),
		storedContract('command.current-id', uid),
		storedContract('command.reused-id', uid),
		storedContract('command.unrelated-id', 'u_unrelated')
	];
	const after = [
		storedContract('command.legacy-id', uid),
		storedContract('command.new-contract-id', uid),
		storedContract('command.reused-id', 'u_replacement'),
		storedContract('command.unrelated-id', 'u_unrelated')
	];
	const [selectedBefore, selectedAfter] = selectContractIdentity(context, before, after);
	const beforeIds = selectedBefore.map((entry) => entry.id);
	const afterIds = selectedAfter.map((entry) => entry.id);

	expect(beforeIds).toEqual(['command.legacy-id', 'command.current-id', 'command.reused-id']);
	expect(afterIds).toEqual(['command.legacy-id', 'command.new-contract-id']);
	expect(identity?.legacy).toEqual(new Set(['command.legacy-id']));
	recordIdentityTransition({ uid, before, after, beforeIds, afterIds, identity });
}

function identityContext(
	reader: Awaited<ReturnType<typeof createContractHistoryReader>>,
	repo: TemporaryRepo,
	uid: string,
	identity: ContractHistoryIdentity | undefined
): ContractLogContext {
	return {
		reader,
		result: {
			head: 'example-head',
			identityScope: 'example contract history',
			scannedCommits: 0,
			truncated: false,
			entries: []
		},
		unit: uid,
		identity,
		options: { root: repo.root, unit: uid }
	};
}

function recordIdentityTransition(example: {
	uid: string;
	before: StoredContract[];
	after: StoredContract[];
	beforeIds: string[];
	afterIds: string[];
	identity: ContractHistoryIdentity | undefined;
}): void {
	const { uid, before, after, beforeIds, afterIds, identity } = example;
	recordExampleCases(
		{
			unitId,
			symbol: 'selectContractIdentity',
			state: 'tracks-uid-aliases-and-excludes-reused-ids',
			evidence: 'examples-cases',
			file: 'tracks-uid-aliases-and-excludes-reused-ids.json'
		},
		[
			{
				name: 'Carries a uid across rename and legacy-id reuse',
				input: {
					unit: uid,
					before: before.map(({ id, uid: entryUid }) => ({
						id,
						...(entryUid ? { uid: entryUid } : {})
					})),
					after: after.map(({ id, uid: entryUid }) => ({
						id,
						...(entryUid ? { uid: entryUid } : {})
					}))
				},
				output: {
					before: beforeIds,
					after: afterIds,
					identity: summarizeIdentity(identity)
				}
			}
		]
	);
}
