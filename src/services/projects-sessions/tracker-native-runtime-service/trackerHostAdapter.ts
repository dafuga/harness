// @harness-uid u_bl6xl2h4a3
import { TrackerHostProcessAdapter } from '../../../adapters/projects-sessions/TrackerHostProcessAdapter';
import { TrackerAdapterLeaseAdapter } from '../../../adapters/projects-sessions/TrackerAdapterLeaseAdapter';
import { trackerTesterLogin } from '../tracker-adapter-poll-service/readTrackerIntake';
import { trackerGmailHost } from './trackerGmailHost';
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
	adapterIssue,
	adapterIssues,
	adapterTimeline,
	adapterWrite
} from './trackerHostAdapterSchema';
import { TrackerAdapterPollService } from '../TrackerAdapterPollService';
import type { TrackerNativeRuntimeOptions } from '../TrackerNativeRuntimeService.types';
import type { TrackerPersistenceService } from '../TrackerPersistenceService';

const designatedRunner = 'daniel-primary-mbp';

export function trackerHostAdapter(
	config: NonNullable<TrackerHostEffects['adapter']>,
	runs: TrackerRunReadRepository,
	now: () => number
): TrackerAdapterPollDependencies {
	const { followUp } = config;
	return {
		manual: config.manual,
		...(config.gmail && { messageProviders: { gmail: trackerGmailHost(config.gmail) } }),
		intakePolicy: (source) =>
			source.target === followUp?.target
				? {
						titlePrefix: followUp.titlePrefix,
						instructions: followUp.issueInstructions,
						priority: (_item, event) =>
							trackerTesterLogin(followUp, event.actor) ? 'urgent' : 'normal',
						matchesItem: (item) =>
							[item.agent, item.project].some(
								(name) => name?.toLowerCase() === source.project.toLowerCase()
							) || item.title.toLowerCase().includes(followUp.titlePrefix.toLowerCase()),
						followUp
					}
				: undefined,
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
		async readIssue({ target }, issue, signal) {
			const response = await driver.request('adapter-issue', { target, issue }, signal);
			return adapterIssue.nullable().parse(response) ?? undefined;
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

/** Poll configured adapters through the shared journal when the host enables them. */
export function configuredHostAdapter(
	store: TrackerPersistenceService,
	runs: TrackerRunReadRepository,
	options: TrackerNativeRuntimeOptions,
	now: () => number
) {
	const { adapter, hostEffects } = options;
	const binding = hostEffects?.adapter;
	const dependencies = adapter
		? { ...adapter, now: adapter.now ?? now }
		: binding && trackerHostAdapter(binding, runs, now);
	return dependencies ? new TrackerAdapterPollService(store, dependencies) : undefined;
}
