import { writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { expect } from 'vitest';
import { contractUnit, writeContract } from './contractsProject';
import { commitHistory, historyGit, runHistory } from './contractHistory';

export async function assertHistoryOwnKeys(root: string): Promise<void> {
	const unit = contractUnit('service.price', 'src/services/billing/Price.ts');
	await rm(join(root, 'specification/units/untracked.json'));
	await writeContract(root, 'price.json', unit);
	commitHistory(root, 'chore: establish raw key base');
	const keys = JSON.parse('{"constructor":null,"__proto__":null,"futureNull":null}');
	await writeContract(root, 'price.json', { ...unit, ...keys });
	const added = JSON.parse(await runHistory(root, 'diff', '--json')).changes[0].fields;
	for (const path of ['constructor', '__proto__', 'futureNull'])
		expect(added.find((field: { path: string }) => field.path === path)).toEqual({
			path,
			kind: 'added',
			after: null
		});
	commitHistory(root, 'feat: raw null keys');
	await writeContract(root, 'price.json', unit);
	const removed = JSON.parse(await runHistory(root, 'diff', '--json')).changes[0].fields;
	for (const path of ['constructor', '__proto__', 'futureNull'])
		expect(removed.find((field: { path: string }) => field.path === path)).toEqual({
			path,
			kind: 'removed',
			before: null
		});
}

export async function assertHistoryMetadataArrays(root: string): Promise<void> {
	const unit = contractUnit('service.price', 'src/services/billing/Price.ts');
	const before = {
		...unit,
		contract: {
			...unit.contract,
			snippets: [
				{ name: 'first', outputs: [{ name: 'result', type: 'number' }] },
				{ name: 'second', outputs: [] }
			],
			storage: [
				{
					name: 'table',
					fields: [
						{ name: 'first', type: 'number' },
						{ name: 'second', type: 'string' }
					]
				}
			],
			errorStatus: 'declared'
		},
		configControls: [
			{ name: 'port', source: 'a.ts', purpose: 'Listen' },
			{ name: 'mode', source: 'a.ts', purpose: 'Mode' }
		],
		future: {
			outputs: [
				{ name: 'first', data: 1 },
				{ name: 'second', data: 2 }
			]
		}
	};
	await writeContract(root, 'price.json', before);
	commitHistory(root, 'feat: metadata arrays');
	const after = JSON.parse(JSON.stringify(before)) as typeof before;
	after.contract.snippets.reverse();
	after.contract.snippets[1].outputs[0].type = 'Money';
	after.contract.storage[0].fields.reverse();
	after.contract.storage[0].fields[1].type = 'Money';
	after.configControls.reverse();
	after.configControls[1].purpose = 'Bind address';
	after.future.outputs.reverse();
	after.contract.errorStatus = 'unknown';
	await writeContract(root, 'price.json', after);
	const paths = JSON.parse(await runHistory(root, 'diff', '--json')).changes[0].fields.map(
		(field: { path: string }) => field.path
	);
	assertMetadataPaths(paths);
	expect(
		JSON.parse(await runHistory(root, 'diff', '--field', 'errors', '--json')).changes[0].fields
	).toEqual([{ path: 'errorStatus', kind: 'changed', before: 'declared', after: 'unknown' }]);
}

function assertMetadataPaths(paths: string[]): void {
	for (const path of [
		'snippets[first].outputs[result].type',
		'storage[table].fields[first].type',
		'configControls[port].purpose',
		'future.outputs[0].name'
	])
		expect(paths).toContain(path);
}

export async function assertLegacyAndMergedHistory(root: string): Promise<void> {
	const legacy = contractUnit('service.legacy', 'src/legacy.ts');
	await writeContract(root, 'price.json', legacy);
	commitHistory(root, 'feat: legacy contract');
	legacy.responsibility = 'Earlier legacy change.';
	await writeContract(root, 'price.json', legacy);
	const early = commitHistory(root, 'feat: earlier legacy text');
	await writeContract(root, 'price.json', { ...legacy, uid: 'u_legacyabcd' });
	commitHistory(root, 'feat: establish legacy uid');
	expect(
		JSON.parse(await runHistory(root, 'log', legacy.id, '--json')).entries.some(
			(entry: { commit: string }) => entry.commit === early
		)
	).toBe(true);
	await writeContract(root, 'price.json', { ...legacy, uid: 'u_reusedabcd' });
	const reused = commitHistory(root, 'feat: replacement identity');
	expect(
		JSON.parse(await runHistory(root, 'log', legacy.id, '--json')).entries.map(
			(entry: { commit: string }) => entry.commit
		)
	).toEqual([reused]);
	const branch = historyGit(root, 'symbolic-ref', '--short', 'HEAD');
	historyGit(root, 'checkout', '-qb', 'authored-branch');
	await writeContract(root, 'branch.json', contractUnit('service.branch', 'src/branch/Branch.ts'));
	const authored = commitHistory(root, 'feat: authored branch contract');
	historyGit(root, 'checkout', '-q', branch);
	await writeFile(join(root, 'notes.txt'), 'Main line change.');
	commitHistory(root, 'chore: main notes');
	historyGit(root, 'merge', '--no-ff', '-qm', 'feat: merge branch', 'authored-branch');
	const merged = historyGit(root, 'rev-parse', 'HEAD');
	expect(
		JSON.parse(await runHistory(root, 'log', '--folder', 'src/branch', '--json')).entries.map(
			(entry: { commit: string }) => entry.commit
		)
	).toEqual([merged, authored]);
}
