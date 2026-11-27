// @harness-uid u_gphcvgm7gv
import { hubSessionMessages } from '../../../../../../src/utils/projects-sessions/hubSessionMessages';
import type {
	TrackerItemRecord,
	TrackerNote,
	TrackerSources
} from '../project-overview/projectOverviewTracker.types';
import type { HomeMessage } from './hubHome.types';
import { homeText } from './homeTrackerText';

/** The Tracker item that holds Chief of Staff's Hub chat; the oldest wins on every computer. */
export const cosChatTitle = 'Hub chat with Chief of Staff';
const threadLimit = 20;
const legacyPrefix = 'Hub message: ';

export function cosChatItem(items: readonly TrackerItemRecord[]): TrackerItemRecord | undefined {
	return items
		.filter(
			(item) =>
				!item.deleted && item.agent === 'cos' && item.kind === 'plan' && item.title === cosChatTitle
		)
		.sort((left, right) => left.id.localeCompare(right.id))[0];
}

/** `<computer>#<run>` of the item's one live run, the only place its Hub messages may go. */
export function liveRunId(sources: Pick<TrackerSources, 'runs'>, itemId: string | undefined) {
	const live = sources.runs.filter(
		(run) => run.item_id === itemId && run.ended_at === null && run.state === 'running' && run.node
	);
	return live.length === 1 ? `${live[0].node}#${live[0].id}` : null;
}

/** Older plain Hub notes stay his. */
function legacyMessages(notes: readonly TrackerNote[]) {
	return notes.flatMap((note, index): HomeMessage[] => {
		if (!note.text.startsWith(legacyPrefix)) return [];
		return [
			{
				id: `note-${note.at}-${index}`,
				text: homeText(note.text.slice(legacyPrefix.length), 900) ?? '',
				at: new Date(note.at).toISOString(),
				from: 'you'
			}
		];
	});
}

/** One Hub message with its receipt, then the replies that name it. */
function sentMessage(message: ReturnType<typeof hubSessionMessages>[number]): HomeMessage[] {
	return [
		{
			id: `hub-${message.id}`,
			messageId: message.id,
			text: homeText(message.text, 900) ?? '',
			at: new Date(message.at).toISOString(),
			from: 'you',
			status: message.status,
			...(message.reason && { reason: homeText(message.reason, 300) ?? '' })
		},
		...message.replies.map(
			(reply, index): HomeMessage => ({
				id: `reply-${message.id}-${index}`,
				text: homeText(reply.text, 900) ?? '',
				at: new Date(reply.at).toISOString(),
				from: 'agent',
				replyTo: message.id
			})
		)
	];
}

/**
 * Daniel's Hub messages with their receipts, and each session reply under the message it names.
 * Other notes are progress, not conversation, and are left out.
 */
export function homeThreadMessages(notes: readonly TrackerNote[] | undefined): HomeMessage[] {
	const all = notes ?? [];
	const entries = [...legacyMessages(all), ...hubSessionMessages(all).flatMap(sentMessage)];
	return entries.sort((left, right) => left.at.localeCompare(right.at)).slice(-threadLimit);
}
