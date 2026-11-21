// @harness-uid u_bl6xl2h4a3
import { TrackerHostProcessAdapter } from '../../../adapters/projects-sessions/TrackerHostProcessAdapter';
import { TrackerAdapterLeaseAdapter } from '../../../adapters/projects-sessions/TrackerAdapterLeaseAdapter';
import { trackerGithubCli } from './trackerGithubCli';
import type { TrackerHostEffects } from './nativeTrackerHostEffects.types';
import type { TrackerRunReadRepository } from '../../../repositories/projects-sessions/TrackerRunReadRepository';
import type {
	TrackerAdapterPollDependencies,
	TrackerAdapterReadQuery,
	TrackerGithubAdapterProvider
} from '../TrackerAdapterPollService.types';
import {
	adapterComments,
	adapterIssues,
	adapterTimeline,
	adapterWrite
} from './trackerHostAdapterSchema';

const designatedRunner = 'daniel-primary-mbp';

export function trackerHostAdapter(
	config: NonNullable<TrackerHostEffects['adapter']>,
	runs: TrackerRunReadRepository,
	now: () => number
): TrackerAdapterPollDependencies {
	return {
		now,
		lease: new TrackerAdapterLeaseAdapter(designatedRunner, config.leaseFile),
		redactText: redactGithubText,
		hasStarted: (itemId) => runs.list({ itemId }).some((run) => run.started_at != null),
		dueOwner: () => designatedRunner,
		provider:
			'driver' in config ? githubProcessProvider(config.driver) : trackerGithubCli(config.github)
	};
}

function githubProcessProvider(executable: string): TrackerGithubAdapterProvider {
	const driver = new TrackerHostProcessAdapter(executable);
	return {
		async *readIssues({ target }, query) {
			yield* adapterIssues.parse(
				await driver.request('adapter-issues', pollInput(target, query), query.signal)
			);
		},
		async readTimeline({ target }, issue, signal) {
			return adapterTimeline.parse(
				await driver.request('adapter-timeline', { target, issue }, signal)
			);
		},
		async *readComments({ target }, query) {
			yield* adapterComments.parse(
				await driver.request('adapter-comments', pollInput(target, query), query.signal)
			);
		},
		async markTracked({ target }, issue, signal) {
			if (!/^[1-9][0-9]{0,9}$/.test(issue)) throw new TypeError('Invalid Tracker issue number');
			adapterWrite.parse(await driver.request('adapter-mark-tracked', { target, issue }, signal));
		}
	};
}

function pollInput(target: string, { since, backfill }: TrackerAdapterReadQuery) {
	return { target, since, backfill };
}

function redactGithubText(text: string): string {
	return text
		.replace(
			/\b(?:gh[pousr]_[a-z0-9_]{12,}|github_pat_[a-z0-9_]{12,}|sk-[a-z0-9_-]{12,})\b/gi,
			'[redacted]'
		)
		.replace(/\b(?:bearer\s+|(?:api[_ -]?key|token|secret)\s*[:=]\s*)[^\s,;]+/gi, '[redacted]');
}
