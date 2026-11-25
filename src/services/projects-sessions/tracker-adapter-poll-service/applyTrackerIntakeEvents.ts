// @harness-uid u_wlip653voz
import { matchesGithubIssue } from './githubIntakeRecord';
import type { TrackerAdapterRepository } from '../../../repositories/projects-sessions/TrackerAdapterRepository';
import type {
	TrackerAdapterCandidate,
	TrackerAdapterLink,
	TrackerAdapterSource
} from '../../../repositories/projects-sessions/TrackerAdapterRepository.types';
import type {
	TrackerAdapterEvent,
	TrackerAdapterIntakeContext,
	TrackerAdapterIntakeRecord
} from '../TrackerAdapterPollService.types';
import type { TrackerPersistenceService } from '../TrackerPersistenceService';
import { trackerEventFields } from './commitTrackerIntake';

export function applyTrackerIntakeEvents(
	repository: TrackerAdapterRepository,
	store: TrackerPersistenceService,
	link: TrackerAdapterLink,
	record: TrackerAdapterIntakeRecord
): number {
	let state = link.remote_state;
	let events = 0;
	let newerState = false;
	for (const event of record.events) {
		if (event.time < link.events_after) continue;
		if (event.state && event.time > record.snapshotAt) newerState = true;
		if (!applyTrackerIntakeEvent(repository, store, link, event)) continue;
		if (event.state) state = event.state;
		events++;
	}
	if (newerState || state === record.state) return events;
	return (
		events + reconcileIssueSnapshot(repository, store, { ...link, remote_state: state }, record)
	);
}

function reconcileIssueSnapshot(
	repository: TrackerAdapterRepository,
	store: TrackerPersistenceService,
	link: TrackerAdapterLink,
	record: TrackerAdapterIntakeRecord
): number {
	const item = repository.item(link.item_id);
	if (!item || item.deleted) return 0;
	if (link.remote_state === null && record.state === 'open') {
		// Adopt an open issue without resetting the manually tracked item's status.
		repository.saveState(link, record.state);
		return 0;
	}
	const fields = trackerEventFields(item, link, {
		state: record.state,
		note: `External item is now ${record.state}: ${record.url}`
	});
	store.appendLocal({ itemId: link.item_id, fields, actor: link.source_id }, () => {
		repository.saveState(link, record.state);
	});
	return 1;
}

export function applyTrackerIntakeEvent(
	repository: TrackerAdapterRepository,
	store: TrackerPersistenceService,
	link: TrackerAdapterLink,
	event: TrackerAdapterEvent
): boolean {
	if (event.time < link.events_after || repository.hasEvent(link, event.id)) return false;
	const item = repository.item(link.item_id);
	if (!item || item.deleted) return false;
	const fields = trackerEventFields(item, link, event);
	store.appendLocal({ itemId: link.item_id, fields, actor: link.source_id }, () => {
		repository.saveEvent(link, event.id);
		if (event.state) repository.saveState(link, event.state);
	});
	return true;
}

export function recordIssueAcceptance(
	context: TrackerAdapterIntakeContext,
	source: TrackerAdapterSource,
	record: TrackerAdapterIntakeRecord
): void {
	const instructions = record.followUp?.instructions;
	if (!instructions) return;
	const original = context.repository.linkByKey(source.id, record.key);
	for (const item of context.repository.candidates()) {
		if (item.adapter_instructions?.includes(instructions)) continue;
		if (!isIssueWork(item, context, source, { record, issueItem: original?.item_id })) continue;
		context.store.appendLocal({
			itemId: item.id,
			actor: source.id,
			fields: {
				adapter_instructions: [item.adapter_instructions, instructions]
					.filter(Boolean)
					.join('\n\n'),
				adapter_notice: record.externalId,
				'note+': `${instructions}\nTester follow-up: ${record.url}`
			}
		});
	}
}

function isIssueWork(
	item: TrackerAdapterCandidate,
	{ policy }: TrackerAdapterIntakeContext,
	source: TrackerAdapterSource,
	{ record, issueItem }: { record: TrackerAdapterIntakeRecord; issueItem?: string }
): boolean {
	if (item.id === issueItem || item.id === record.followUp?.coveredItem) return true;
	return (
		item.kind === 'task' &&
		matchesGithubIssue(source, record, item, policy?.matchesItem) &&
		[...item.title.matchAll(/#(\d+)/g)].every(([, key]) => key === record.key)
	);
}
