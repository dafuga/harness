// @harness-uid u_wlip653voz
import { createHash } from 'node:crypto';
import type {
	TrackerMessageMatch,
	TrackerMessageSource
} from '../../../repositories/projects-sessions/TrackerAdapterRepository.types';
import { TrackerItemReadRepository } from '../../../repositories/projects-sessions/TrackerItemReadRepository';
import type {
	TrackerAdapterAction,
	TrackerAdapterIntakeContext,
	TrackerMessageCandidate
} from '../TrackerAdapterPollService.types';
import { cosSendWindowStart } from '../tracker-native-runtime-service/trackerCosWindow';
import { recordWatchdogAlert } from '../tracker-native-runtime-service/trackerHostWatchdogAlerts';
import { commitTrackerIntake } from './commitTrackerIntake';
import { TrackerAdapterPollError } from './trackerAdapterPollError';
import type { TrackerMessageReadOptions } from './readTrackerMessageIntake.types';

const lisbonClock = new Intl.DateTimeFormat('en-GB', {
	timeZone: 'Europe/Lisbon',
	hour: '2-digit',
	minute: '2-digit',
	hourCycle: 'h23'
});

export function trackerMessageQuiet(source: TrackerMessageSource, now: number): boolean {
	return (
		cosSendWindowStart(now) === null ||
		Boolean(source.quiet_hours && insideHours(lisbonClock.format(now), source.quiet_hours))
	);
}

function insideHours(local: string, period: string): boolean {
	const [start, end] = period.split('-');
	return start < end ? local >= start && local < end : local >= start || local < end;
}

/** Read matching messages and atomically register their local actions. */
export async function readTrackerMessageIntake(
	context: TrackerAdapterIntakeContext,
	source: TrackerMessageSource,
	options: TrackerMessageReadOptions
) {
	const { query, dryRun, preview } = options;
	const provider = context.dependencies.messageProviders?.[source.type];
	if (!provider) throw new TrackerAdapterPollError('Message adapter is unavailable for this query');
	const actions: TrackerAdapterAction[] = [];
	const acceptReceipt = messageDeduper(context.repository, source.id, preview);
	const since = Math.max(source.enabled_at, query.since);
	const now = context.dependencies.now ?? Date.now;
	for await (const message of provider(source.match, query)) {
		query.signal.throwIfAborted();
		const at = now();
		if (!dryRun && trackerMessageQuiet(source, at))
			return { actions, events: 0, deferred: true as const };
		const id = matchingReceiptId(source.match, message, since);
		if (!id || !acceptReceipt(id)) continue;
		const action = planMessageAction(context, source, id);
		if (!dryRun) applyMessageAction(context, source, action, at);
		actions.push(action);
	}
	return { actions, events: 0 };
}

function messageDeduper(
	repository: TrackerAdapterIntakeContext['repository'],
	sourceId: string,
	preview = false
) {
	const seen = new Set<string>();
	return (id: string): boolean => {
		if (seen.has(id) || (!preview && repository.link(sourceId, id))) return false;
		seen.add(id);
		return true;
	};
}

function matchesMessage(match: TrackerMessageMatch, message: TrackerMessageCandidate): boolean {
	const sender = message.sender?.toLowerCase();
	return (
		match.threads.includes(message.threadId) ||
		Boolean(
			sender && (match.senders.includes(sender) || match.domains.includes(sender.split('@')[1]))
		) ||
		Boolean(match.keyword && message.keywordMatched)
	);
}

function matchingReceiptId(
	match: TrackerMessageMatch,
	message: TrackerMessageCandidate,
	since: number
) {
	if (!Number.isSafeInteger(message.receivedAt) || message.receivedAt < since) return undefined;
	if (!matchesMessage(match, message)) return undefined;
	return `message:${createHash('sha256').update(message.id).digest('hex')}`;
}

function planMessageAction(
	context: TrackerAdapterIntakeContext,
	{ effect, title }: TrackerMessageSource,
	id: string
): TrackerAdapterAction {
	const base = { external_id: id, title, url: '', auto_launch: false };
	if (effect.kind === 'task') return { ...base, action: 'create', auto_launch: effect.launch };
	const items = new TrackerItemReadRepository(context.store.database);
	return { ...base, action: 'notify', item_id: items.resolve(effect.item_id).id };
}

function applyMessageAction(
	context: TrackerAdapterIntakeContext,
	source: TrackerMessageSource,
	action: TrackerAdapterAction,
	now: number
): void {
	const id = action.external_id;
	if (source.effect.kind === 'task') {
		commitTrackerIntake(
			context,
			taskSource(source, source.effect),
			{
				externalId: id,
				key: id,
				title: action.title,
				url: '',
				notes: 'An incoming message matched the configured rule.',
				state: 'open',
				historical: false,
				autoLaunch: action.auto_launch,
				syncBack: false,
				events: [],
				snapshotAt: now
			},
			action
		);
		return;
	}
	const itemId = action.item_id!;
	recordWatchdogAlert(
		context.store,
		{
			itemId,
			kind: 'alert',
			reason: action.title,
			key: `${itemId}:message-trigger:${source.id}:${id}`,
			identity: id,
			persist: () =>
				context.repository.saveLink({
					source_id: source.id,
					external_id: id,
					external_key: id,
					item_id: itemId,
					remote_state: null,
					events_after: now,
					owned: 0,
					sync_pending: 0
				})
		},
		now
	);
}

function taskSource(
	source: TrackerMessageSource,
	effect: Extract<TrackerMessageSource['effect'], { kind: 'task' }>
) {
	return {
		...source,
		...effect,
		model: null,
		computer: 'auto'
	};
}
