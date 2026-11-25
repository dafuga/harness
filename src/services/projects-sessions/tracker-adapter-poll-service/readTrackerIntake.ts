// @harness-uid u_wlip653voz
import type { TrackerAdapterSource } from '../../../repositories/projects-sessions/TrackerAdapterRepository.types';
import type {
	TrackerAdapterAction,
	TrackerAdapterCommentEvent,
	TrackerGithubFollowUpPolicy,
	TrackerAdapterIntakeContext,
	TrackerAdapterReadQuery,
	TrackerGithubComment,
	TrackerGithubIssue
} from '../TrackerAdapterPollService.types';
import {
	applyTrackerIntakeEvent,
	applyTrackerIntakeEvents,
	recordIssueAcceptance
} from './applyTrackerIntakeEvents';
import { assertTrackerPollActive } from './trackerAdapterPollError';
import { commitTrackerIntake, planTrackerIntake } from './commitTrackerIntake';
import {
	followUpInstructions,
	githubCommentEvent,
	hasFollowUpRequest,
	planGithubFollowUp,
	readGithubIntakeRecord
} from './githubIntakeRecord';

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
			record.acceptanceInstructions = issueAcceptance(context, source, issue);
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

function issueAcceptance(
	{ policy, repository }: TrackerAdapterIntakeContext,
	source: TrackerAdapterSource,
	issue: TrackerGithubIssue
): string | undefined {
	const rule = policy?.followUp;
	if (!rule) return undefined;
	const key = String(issue.number);
	if (trackerTesterLogin(rule, issue.user?.login) || repository.hasFollowUp(source.id, key))
		return followUpInstructions(rule, key);
	return undefined;
}

export async function readTrackerComments(
	context: TrackerAdapterIntakeContext,
	source: TrackerAdapterSource,
	query: TrackerAdapterReadQuery,
	options: { dryRun: boolean; commentsOnly: boolean }
) {
	const { redactText } = context.dependencies;
	const actions: TrackerAdapterAction[] = [];
	const comments = trackerCommentFeed(context, source, query, options);
	const process = commentIntake(context, source, query, options);
	const seen = new Set<string>();
	let events = 0;
	for await (const comment of comments) {
		assertTrackerPollActive(query.signal);
		const event = githubCommentEvent(source, comment, redactText);
		if (!event || seen.has(event.id)) continue;
		seen.add(event.id);
		const result = await process(comment, event);
		events += result.events;
		if (result.action) actions.push(result.action);
	}
	return { actions, events };
}

function trackerCommentFeed(
	{ policy, dependencies: { provider } }: TrackerAdapterIntakeContext,
	source: TrackerAdapterSource,
	query: TrackerAdapterReadQuery,
	{ commentsOnly, dryRun }: { commentsOnly: boolean; dryRun: boolean }
) {
	const followUp = source.kind === 'task' && policy?.followUp;
	if (commentsOnly && (!followUp || !provider.readIssue || !provider.readComments))
		throw new TypeError('Comment backfill is unavailable for this source');
	if (!provider.readComments || (dryRun && !followUp)) return [];
	return provider.readComments(source, query);
}

function commentIntake(
	context: TrackerAdapterIntakeContext,
	source: TrackerAdapterSource,
	query: TrackerAdapterReadQuery,
	{ dryRun, commentsOnly }: { dryRun: boolean; commentsOnly: boolean }
) {
	const { repository, store, policy } = context;
	const followUp = source.kind === 'task' ? policy?.followUp : undefined;
	const processFollowUp = followUp
		? followUpIntake(context, source, query, { dryRun, commentsOnly })
		: undefined;
	const notesOnly = !dryRun && !commentsOnly;
	return async (comment: TrackerGithubComment, event: TrackerAdapterCommentEvent) => {
		const login = comment.user?.login?.toLowerCase();
		if (followUp && isMaintainerComment(source, comment, login)) return { events: 0 };
		if (processFollowUp && followUp && trackerTesterLogin(followUp, login))
			return { events: 0, action: await processFollowUp(comment, event) };
		const link = notesOnly && repository.linkByKey(source.id, event.key);
		return {
			events: Number(Boolean(link && applyTrackerIntakeEvent(repository, store, link, event)))
		};
	};
}

export function trackerTesterLogin(rule: TrackerGithubFollowUpPolicy, actor?: string): boolean {
	return Boolean(
		actor &&
		[rule.author, ...(rule.additionalAuthors ?? [])].some(
			(login) => login.toLowerCase() === actor.toLowerCase()
		)
	);
}

function isMaintainerComment(
	source: TrackerAdapterSource,
	comment: TrackerGithubComment,
	login: string | undefined
): boolean {
	return login === source.target.split('/')[0] || comment.author_association === 'OWNER';
}

function followUpIntake(
	context: TrackerAdapterIntakeContext,
	source: TrackerAdapterSource,
	query: TrackerAdapterReadQuery,
	{ dryRun, commentsOnly }: { dryRun: boolean; commentsOnly: boolean }
) {
	const { repository, policy } = context;
	const followUp = policy?.followUp;
	if (!followUp) throw new TypeError('Missing comment follow-up policy');
	const lookup = issueLookup(context, source, query.signal);
	const earliest = commentsOnly ? query.since : Math.max(query.since, source.enabled_at);
	return async (comment: TrackerGithubComment, event: TrackerAdapterCommentEvent) => {
		if (
			event.time < earliest ||
			repository.link(source.id, event.id) ||
			!hasFollowUpRequest(comment.body ?? '')
		)
			return undefined;
		if (!(await lookup(event.key))) return undefined;
		const record = planGithubFollowUp(source, event, { ...policy, followUp });
		const action = planTrackerIntake(context, source, record);
		if (!dryRun) {
			recordIssueAcceptance(context, source, record);
			if (action.action !== 'covered')
				action.item_id = commitTrackerIntake(context, source, record, action).item_id;
		}
		return action;
	};
}

function issueLookup(
	{ dependencies: { provider } }: TrackerAdapterIntakeContext,
	source: TrackerAdapterSource,
	signal: AbortSignal
) {
	const issues = new Map<string, boolean>();
	return async (key: string) => {
		if (!issues.has(key)) {
			if (!provider.readIssue)
				throw new TypeError('Comment follow-up requires independent issue lookup');
			const issue = await provider.readIssue(source, key, signal);
			assertTrackerPollActive(signal);
			issues.set(
				key,
				issue?.state === 'open' && !issue.pull_request && String(issue.number) === key
			);
		}
		return issues.get(key);
	};
}
