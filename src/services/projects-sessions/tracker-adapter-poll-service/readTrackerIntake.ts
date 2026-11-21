// @harness-uid u_wlip653voz
import type { TrackerAdapterSource } from '../../../repositories/projects-sessions/TrackerAdapterRepository.types';
import type {
	TrackerAdapterAction,
	TrackerAdapterIntakeContext,
	TrackerAdapterReadQuery
} from '../TrackerAdapterPollService.types';
import { applyTrackerIntakeEvent, applyTrackerIntakeEvents } from './applyTrackerIntakeEvents';
import { assertTrackerPollActive } from './trackerAdapterPollError';
import { commitTrackerIntake, planTrackerIntake } from './commitTrackerIntake';
import { githubCommentEvent, readGithubIntakeRecord } from './githubIntakeRecord';

export async function readTrackerIssues(
	context: TrackerAdapterIntakeContext,
	source: TrackerAdapterSource,
	query: TrackerAdapterReadQuery,
	dryRun: boolean
) {
	const { repository, store, dependencies, policy } = context;
	const actions: TrackerAdapterAction[] = [];
	let events = 0;
	const seen = new Set<number>();
	for await (const issue of dependencies.provider.readIssues(source, query)) {
		assertTrackerPollActive(query.signal);
		if (seen.has(issue.id) || issue.pull_request) continue;
		seen.add(issue.id);
		let link = repository.link(source.id, String(issue.id));
		const options = {
			mapped: Boolean(link),
			backfill: query.backfill,
			signal: query.signal,
			titlePrefix: policy?.titlePrefix
		};
		const record = await readGithubIntakeRecord(source, issue, options, dependencies);
		assertTrackerPollActive(query.signal);
		if (!record) continue;
		if (!link) {
			const action = planTrackerIntake(context, source, record);
			if (!dryRun) {
				link = commitTrackerIntake(context, source, record, action);
				action.item_id = link.item_id;
			}
			actions.push(action);
		}
		if (link && !dryRun) events += applyTrackerIntakeEvents(repository, store, link, record);
	}
	return { actions, events };
}

export async function readTrackerComments(
	context: TrackerAdapterIntakeContext,
	source: TrackerAdapterSource,
	query: TrackerAdapterReadQuery
): Promise<number> {
	const { repository, store, dependencies } = context;
	const { provider, redactText } = dependencies;
	if (!provider.readComments) return 0;
	let events = 0;
	for await (const comment of provider.readComments(source, query)) {
		assertTrackerPollActive(query.signal);
		const event = githubCommentEvent(source, comment, redactText);
		if (!event) continue;
		const link = repository.linkByKey(source.id, event.key);
		if (link && applyTrackerIntakeEvent(repository, store, link, event)) events++;
	}
	return events;
}
