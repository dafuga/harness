// @harness-uid u_fwtzg2uaq6
import type { QaSyncState } from '../../../core/agents-providers/qaSync.types';
import { matchQaThread } from './matchQaThread';
import type { QaCandidate } from './discoverQaThreads.types';
import type { QaRun } from './qaRun.types';

/** QA parents posted inside the lookback window, each with its stored or new thread state. */
export async function discoverQaThreads(
	run: QaRun,
	state: QaSyncState,
	oldest: string
): Promise<QaCandidate[]> {
	const found: QaCandidate[] = [];
	for (const channel of run.config.slack.channels) {
		for (const parent of await run.ports.slack.history(channel, oldest)) {
			const match = matchQaThread(parent, run.config);
			if (match.kind === 'ambiguous')
				run.report.warnings.push(
					`Skipped ${channel}:${parent.ts}: heading #${match.issue} links issue(s) ${match.linked.join(', ')}.`
				);
			if (match.kind !== 'qa') continue;
			const key = `${channel}:${parent.ts}`;
			const thread = (state.threads[key] ??= {
				...{ channel, parentTs: parent.ts, issue: match.issue },
				cursor: state.since,
				approved: []
			});
			thread.issue = match.issue;
			found.push({ thread, parent });
		}
	}
	return found;
}
