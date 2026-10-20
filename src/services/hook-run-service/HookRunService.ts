import { pushedRefs } from './pushedRefs';
import { historyAttach } from '../../workflows/runHistory';
import { verifyCheck, verifyRun } from '../../workflows/runVerify';

export interface HookOutcome {
	/** Commits that may be pushed, each with the record that proves it. */
	verified: Array<{ commit: string; record: string }>;
	/** Commits that may not be pushed, each with what failed. */
	blocked: Array<{ commit: string; failures: string[] }>;
}

/**
 * The pre-push gate. Each source commit about to be pushed must be proven by a passing record;
 * when it has none, the exact commit is verified in a clean snapshot, so uncommitted work in
 * the worktree plays no part. Whatever the outcome, the record is then attached.
 */
export class HookRunService {
	constructor(private readonly root: string) {}

	async prePush(input: string): Promise<HookOutcome> {
		const outcome: HookOutcome = { verified: [], blocked: [] };
		for (const commit of pushedRefs(input)) {
			const proven = await this.proven(commit);
			const record = proven ?? (await this.verify(commit));
			await historyAttach({ root: this.root, commit, record: record.id });
			if (record.failures.length === 0) outcome.verified.push({ commit, record: record.id });
			else outcome.blocked.push({ commit, failures: record.failures });
		}
		return outcome;
	}

	/** The record that already proves the commit, if a stored one does. */
	private async proven(commit: string): Promise<{ id: string; failures: string[] } | undefined> {
		const report = await verifyCheck({ root: this.root, commit }).catch(() => undefined);
		return report?.status === 'passed' ? { id: report.record, failures: [] } : undefined;
	}

	/** Verifies the commit now; a failed run is kept and reported, never turned into a pass. */
	private async verify(commit: string): Promise<{ id: string; failures: string[] }> {
		const { record } = await verifyRun({ root: this.root, commit });
		const failures = record.status === 'passed' ? [] : record.failures;
		const unexplained = record.status === 'failed' && failures.length === 0;
		return { id: record.id, failures: unexplained ? ['verification failed'] : failures };
	}
}
