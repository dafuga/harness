// @harness-uid u_hstsnapabc
import { stat, readFile } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
import { GitAdapter } from '../../../adapters/git-source-history/GitAdapter';
import { fail } from '../../../core/development-tooling/errors';
import { unitsDirectory } from '../../../core/development-tooling/unitsConfig';
import { contractFiles } from './contractDocuments';
import { isRecord } from './contractSemantics';
import type {
	ContractHistoryReader,
	ContractSnapshotContext,
	StoredContract
} from './contractHistory.types';

/** Blob and snapshot caches contain only object ids returned by Git, never user-supplied refs. */
export async function createContractHistoryReader(root: string): Promise<ContractHistoryReader> {
	const directory = resolve(root);
	if (!(await stat(directory).catch(() => undefined))?.isDirectory())
		return fail(`Contract project root is not a directory: ${directory}.`);
	const git = new GitAdapter(directory);
	if (!(await git.isRepository()))
		return fail(`Contract history requires a Git worktree: ${directory}.`);
	const context: ContractSnapshotContext = {
		root: directory,
		git,
		blobs: new Map(),
		parsed: new Map(),
		snapshots: new Map()
	};
	return { git, read: (revision) => readSnapshot(context, revision) };
}

async function readSnapshot(
	context: ContractSnapshotContext,
	revision: string
): Promise<StoredContract[]> {
	if (revision === 'empty') return [];
	if (revision === 'working-tree') return readWorkingContracts(context.root);
	const cached = context.snapshots.get(revision);
	if (revision !== 'index' && cached) return cached;
	const records = await snapshotBlobs(context.git, revision);
	const missing = [...new Set(records.map(([, blob]) => blob))].filter(
		(blob) => !context.blobs.has(blob)
	);
	await readBlobs(context, missing);
	const contracts = records.map(([path, blob]) => {
		const raw = context.blobs.get(blob)!;
		const data = context.parsed.get(blob) ?? parseContract(raw, path);
		context.parsed.set(blob, data);
		return storedContract(path, raw, data);
	});
	checkIdentities(contracts);
	if (revision !== 'index') {
		context.snapshots.set(revision, contracts);
		if (context.snapshots.size > 2)
			context.snapshots.delete(context.snapshots.keys().next().value!);
	}
	return contracts;
}

async function snapshotBlobs(git: GitAdapter, revision: string): Promise<string[][]> {
	const index = revision === 'index';
	const output = await git.run(
		index
			? ['ls-files', '--stage', '-z', '--', unitsDirectory]
			: ['ls-tree', '-r', '-z', revision, '--', unitsDirectory]
	);
	return output
		.split('\0')
		.filter(Boolean)
		.flatMap((line) => {
			const tab = line.indexOf('\t'),
				metadata = line.slice(0, tab).split(' '),
				path = line.slice(tab + 1);
			if (!path.endsWith('.json')) return [];
			if (index && metadata[2] !== '0')
				return fail(`Unmerged contract in Git index: ${path}. Resolve it before --staged.`);
			return /^100(644|755)$/.test(metadata[0]) ? [[path, metadata[index ? 1 : 2]]] : [];
		});
}

async function readBlobs(context: ContractSnapshotContext, ids: string[]): Promise<void> {
	if (!ids.length) return;
	const bytes = await context.git.bytes(['cat-file', '--batch'], { input: `${ids.join('\n')}\n` });
	let offset = 0;
	for (const id of ids) {
		const end = bytes.indexOf(10, offset);
		const [found, kind, length] = bytes.subarray(offset, end).toString('utf8').split(' ');
		const size = Number(length);
		if (found !== id || kind !== 'blob' || !Number.isSafeInteger(size) || size < 0)
			fail(`Cannot read contract blob ${id}.`);
		context.blobs.set(id, bytes.subarray(end + 1, end + 1 + size).toString('utf8'));
		offset = end + size + 2;
	}
}

async function readWorkingContracts(root: string): Promise<StoredContract[]> {
	const paths = await contractFiles(join(root, unitsDirectory));
	const contracts: StoredContract[] = [];
	for (let offset = 0; offset < paths.length; offset += 64)
		contracts.push(
			...(await Promise.all(
				paths.slice(offset, offset + 64).map(async (path) => {
					const label = relative(root, path).split('\\').join('/');
					const raw = await readFile(path, 'utf8');
					return storedContract(label, raw, parseContract(raw, label));
				})
			))
		);
	checkIdentities(contracts);
	return contracts;
}

function parseContract(raw: string, path: string): Record<string, unknown> {
	let data: unknown;
	try {
		data = JSON.parse(raw) as unknown;
	} catch {
		return fail(`Cannot read JSON contract ${path}.`);
	}
	if (!isRecord(data) || typeof data.id !== 'string' || !data.id)
		return fail(`Invalid historical contract ${path}: expected an object with a nonempty id.`);
	return data;
}

function storedContract(path: string, raw: string, data: Record<string, unknown>): StoredContract {
	const source = isRecord(data.owns) && Array.isArray(data.owns.source) ? data.owns.source : [];
	return {
		id: String(data.id),
		...(typeof data.uid === 'string' && data.uid ? { uid: data.uid } : {}),
		kind: typeof data.kind === 'string' ? data.kind : '',
		contractPath: path,
		sourcePaths: source.filter((item): item is string => typeof item === 'string'),
		raw,
		data
	};
}

function checkIdentities(contracts: StoredContract[]): void {
	const ids = new Set<string>(),
		uids = new Set<string>();
	for (const contract of contracts) {
		if (ids.has(contract.id) || (contract.uid && uids.has(contract.uid)))
			fail(`Duplicate contract identity "${contract.id}" (${contract.contractPath}).`);
		ids.add(contract.id);
		if (contract.uid) uids.add(contract.uid);
	}
}
