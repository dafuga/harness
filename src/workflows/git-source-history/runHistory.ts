import { resolve } from 'node:path';
import { GitAdapter } from '../../adapters/git-source-history/GitAdapter';
import { fail } from '../../core/development-tooling/errors';
import { VerificationStoreRepository } from '../../repositories/verification-evidence/VerificationStoreRepository';
import {
	EvidenceAttachService,
	type Attached
} from '../../services/verification-evidence/evidence-attach-service/EvidenceAttachService';
import { EvidenceRestoreService } from '../../services/verification-evidence/EvidenceRestoreService';
import {
	HistoryStatusService,
	type CommitStatus
} from '../../services/verification-evidence/history-status-service/HistoryStatusService';

export interface HistoryOptions {
	root?: string;
	/** Source commit; `HEAD` by default. */
	commit?: string;
	/** Record id or record file; the latest record of the commit when omitted. */
	record?: string;
}

/** Resolves a revision to a commit of this repository. */
export async function sourceCommit(root: string, reference = 'HEAD'): Promise<string> {
	const git = new GitAdapter(root);
	if (!(await git.isRepository())) return fail('harness history needs a Git repository.');
	const commit = await git.attempt(['rev-parse', '--verify', '--quiet', `${reference}^{commit}`]);
	return commit ?? fail(`"${reference}" does not name a commit in this repository.`);
}

/** Persists a stored record of a commit to the evidence branch, notes and archive refs. */
export async function historyAttach(options: HistoryOptions = {}): Promise<Attached> {
	const root = resolve(options.root ?? process.cwd());
	const commit = await sourceCommit(root, options.commit);
	await new EvidenceRestoreService(root).restore();
	const store = new VerificationStoreRepository(root);
	const stored = options.record ? store.load(options.record) : store.latest(commit);
	if (!stored) {
		return fail(
			options.record
				? `${options.record} is not a verification record.`
				: `No verification record exists for ${commit}; run harness verify run.`
		);
	}
	return new EvidenceAttachService(root).attach(commit, stored);
}

/** What Git history proves about one commit. */
export async function historyStatus(options: HistoryOptions = {}): Promise<CommitStatus> {
	const root = resolve(options.root ?? process.cwd());
	const commit = await sourceCommit(root, options.commit);
	return new HistoryStatusService(root).status(commit);
}

export function renderStatus(status: CommitStatus): string {
	const verdict = status.verified ? 'is verified' : 'is not verified';
	const records = status.records.flatMap((record) => [
		`  ${record.record.slice(0, 12)} ${record.status}${record.valid ? '' : ' (not usable)'}`,
		...record.problems.map((problem) => `    ${problem}`)
	]);
	const attached = `${status.records.length} attached record${status.records.length === 1 ? '' : 's'}`;
	return [
		`Commit ${status.commit} ${verdict} by Git history: ${attached}.`,
		...records,
		...status.problems.map((problem) => `  ${problem}`)
	].join('\n');
}
