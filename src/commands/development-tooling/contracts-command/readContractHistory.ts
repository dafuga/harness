// @harness-uid u_hstreadabc
import { fail } from '../../../core/development-tooling/errors';
import { unitsDirectory } from '../../../core/development-tooling/unitsConfig';
import { createContractHistoryReader } from './readContractSnapshot';
import { contractComparison, resolveContractRevision } from './contractRevisions';
import { diffContractSnapshots, validateHistoryFields } from './diffContractSnapshots';
import { currentContractIdentity, selectContractIdentity } from './contractHistoryIdentity';
import type {
	ContractDiff,
	ContractHistoryOptions,
	ContractHistoryReader,
	ContractHistoryCommit,
	ContractLogContext,
	ContractLog
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

/** Walk reachable contract commits; merge results use their actual first-parent snapshot. */
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
		'--full-history',
		'--parents',
		'--topo-order',
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
			'All reachable contract commits; merge deltas use the first parent. Stable uid follows renames, with unchanged-id fallback before uid introduction; pre-uid identity across reused ids or unrelated branches can be ambiguous.',
		scannedCommits: 0,
		truncated: false,
		entries: []
	};
	const context: ContractLogContext = {
		reader,
		result,
		unit,
		identity: await currentContractIdentity(reader, unit),
		options
	};
	const limit = last ? 1 : (options.limit ?? 20);
	const commits = contractHistoryCommits(output);
	await restoreContractParents(reader, commits);
	for (const [index, commit] of commits.entries()) {
		await appendContractCommit(context, commit);
		if (result.entries.length >= limit) {
			result.truncated = hasMoreContractHistory(last, index, commits.length);
			break;
		}
	}
	validateLastContractLog(result, unit, last);
	return result;
}

function hasMoreContractHistory(last: boolean, index: number, count: number): boolean {
	return !last && index + 1 < count;
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
	const { reader, result, options } = context;
	const [before, after] = await Promise.all([
		reader.read(commit.parent),
		reader.read(commit.commit)
	]);
	const [selectedBefore, selectedAfter] = selectContractIdentity(context, before, after);
	const diff = diffContractSnapshots(selectedBefore, selectedAfter, {
		...options,
		unit: undefined,
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

async function restoreContractParents(
	reader: ContractHistoryReader,
	commits: ContractHistoryCommit[]
): Promise<void> {
	const byCommit = new Map(commits.map((commit) => [commit.commit, commit]));
	for (let offset = 0; offset < commits.length; offset += 256) {
		const ids = commits.slice(offset, offset + 256).map((entry) => entry.commit);
		const output = await reader.git.run(['rev-list', '--no-walk', '--parents', ...ids, '--']);
		for (const line of output.split('\n')) {
			const [id, parent] = line.split(' ');
			const entry = byCommit.get(id);
			if (entry) entry.parent = parent ?? 'empty';
		}
	}
}
