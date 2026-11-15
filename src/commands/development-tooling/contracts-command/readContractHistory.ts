// @harness-uid u_hstreadabc
import { fail } from '../../../core/development-tooling/errors';
import { unitsDirectory } from '../../../core/development-tooling/unitsConfig';
import { createContractHistoryReader } from './readContractSnapshot';
import { contractComparison, resolveContractRevision } from './contractRevisions';
import { diffContractSnapshots, validateHistoryFields } from './diffContractSnapshots';
import type {
	ContractDiff,
	ContractHistoryOptions,
	ContractHistoryReader,
	ContractHistoryCommit,
	ContractLogContext,
	ContractLog,
	StoredContract
} from './contractHistory.types';

export async function readContractDiff(
	revisions: string[],
	options: ContractHistoryOptions
): Promise<ContractDiff> {
	const reader = await createContractHistoryReader(options.root ?? process.cwd());
	const [base, head] = await contractComparison(reader.git, revisions, options);
	const [before, after] = await Promise.all([reader.read(base), reader.read(head)]);
	return { ...diffContractSnapshots(before, after, options), base, head };
}

/** Walk first-parent commits; immutable blobs and decoded JSON are reused across snapshots. */
export async function readContractLog(
	unit: string,
	options: ContractHistoryOptions,
	last = false
): Promise<ContractLog> {
	validateHistoryFields(options.field);
	const reader = await createContractHistoryReader(options.root ?? process.cwd());
	const head = await resolveContractRevision(reader.git, 'HEAD');
	const since = options.since
		? await resolveContractRevision(reader.git, options.since)
		: undefined;
	const output = await reader.git.run([
		'log',
		'--first-parent',
		'-z',
		'--format=%H%x00%P%x00%aI%x00%an%x00%ae%x00%s',
		since ? `${since}..${head}` : head,
		'--',
		unitsDirectory
	]);
	const result: ContractLog = {
		head,
		...(since ? { since } : {}),
		identityScope:
			'First-parent commits; stable uid, otherwise unchanged id. File moves require preserved identity.',
		scannedCommits: 0,
		truncated: false,
		entries: []
	};
	const context: ContractLogContext = {
		reader,
		result,
		unit,
		identity: await currentIdentity(reader, unit),
		options
	};
	const limit = last ? 1 : (options.limit ?? 20);
	const commits = contractHistoryCommits(output);
	for (const [index, commit] of commits.entries()) {
		await appendContractCommit(context, commit);
		if (result.entries.length >= limit) {
			result.truncated = index + 1 < commits.length;
			break;
		}
	}
	validateLastContractLog(result, unit, last);
	return result;
}

function validateLastContractLog(result: ContractLog, unit: string, last: boolean): void {
	if (last && !result.entries.length) fail(`No committed contract changes match "${unit}".`);
}

function contractHistoryCommits(output: string): ContractHistoryCommit[] {
	const parts = output.split('\0');
	const commits: ContractHistoryCommit[] = [];
	for (let index = 0; index + 5 < parts.length; index += 6) {
		const [commit, parents, date, name, email, subject] = parts.slice(index, index + 6);
		commits.push({ commit, parent: parents.split(' ')[0] || 'empty', date, name, email, subject });
	}
	return commits;
}

async function appendContractCommit(
	context: ContractLogContext,
	commit: ContractHistoryCommit
): Promise<void> {
	const { reader, result, unit, options } = context;
	const [before, after] = await Promise.all([
		reader.read(commit.parent),
		reader.read(commit.commit)
	]);
	context.identity = historicalIdentity(context.identity, unit, before, after);
	const diff = diffContractSnapshots(before, after, {
		...options,
		unit: context.identity || undefined,
		limit: undefined
	});
	result.scannedCommits++;
	if (diff.total)
		result.entries.push({
			commit: commit.commit,
			date: commit.date,
			author: { name: commit.name, email: commit.email },
			subject: commit.subject,
			summary: diff.summary,
			changes: diff.changes
		});
}

async function currentIdentity(reader: ContractHistoryReader, unit: string): Promise<string> {
	if (!unit) return '';
	const entry = (await reader.read(await resolveContractRevision(reader.git, 'HEAD'))).find(
		(item) => item.id === unit || item.uid === unit
	);
	return entry?.uid ?? unit;
}

function historicalIdentity(
	identity: string,
	unit: string,
	before: StoredContract[],
	after: StoredContract[]
): string {
	if (!unit || identity !== unit) return identity;
	return (
		[...after, ...before].find((entry) => entry.id === unit || entry.uid === unit)?.uid ?? identity
	);
}
