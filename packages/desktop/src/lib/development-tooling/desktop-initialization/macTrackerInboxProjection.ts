// @harness-uid u_pjjnyuon4j
import type { TrackerItem } from '../../../../../../src/repositories/projects-sessions/TrackerItemReadRepository.types';
import type { TrackerListedRun } from '../../../../../../src/repositories/projects-sessions/TrackerRunReadRepository.types';
import {
	trackerPlanningSchema,
	trackerStageSchema
} from '../../../../../../src/utils/projects-sessions/trackerPlanning';
import { trackerUpcomingReminder } from '../../../../../../src/utils/projects-sessions/trackerUpcomingReminder';
import { trackerPersonalAgent } from '../../../../../../src/utils/projects-sessions/trackerUnattendedHold';
import { trackerStructuredAsk } from '../../../../../../src/utils/projects-sessions/trackerStructuredAsk';
import { sanitizeTrackerText } from '../../../../../../src/utils/projects-sessions/sanitizeTrackerText';
import type {
	InboxConfirmKind,
	InboxDetail,
	InboxRow
} from '../../../models/development-tooling/TrackerInbox.types';
import { itemBucket } from '../tracker-inbox/trackerInbox';
import type { TrackerInboxItemReply } from './MacTrackerInboxService.types';

export const safeId = /^[a-z0-9_-]{1,80}$/;

export function projectRow(item: TrackerItem): InboxRow {
	const open = !trackerPersonalAgent(item.agent) && trackerStructuredAsk(item);
	return {
		header: projectHeader(item),
		bucket: itemBucket(item.status ?? 'open', open),
		...(open && {
			ask: { question: safe(item.question), since: item.asked_at ?? item.updated_at }
		})
	};
}

export function visible(item: TrackerItem): boolean {
	return Boolean(safeId.test(item.id) && item.title && !item.deleted && !item.sensitive);
}

export function projectHeader(item: TrackerItem) {
	const stage = trackerStageSchema.safeParse(item.stage);
	const reminder = trackerUpcomingReminder(
		{ ...item, remindAt: item.remind_at, autoLaunch: Boolean(item.auto) },
		Date.now()
	);
	return {
		id: item.id,
		...(reminder && { reminder }),
		title: safe(item.title),
		project: safe(item.project || item.agent),
		status: item.status ?? 'open',
		...(stage.success && { stage: stage.data }),
		updatedAt: item.updated_at,
		dueAt: item.due
	};
}

export function projectDetail(reply: TrackerInboxItemReply): InboxDetail {
	const { item, revision, flaggedAt, runs } = reply;
	const notes = item.notes_log ?? [];
	const planning = trackerPlanningSchema.safeParse(item.planning);
	return {
		header: projectHeader(item),
		...(planning.success && { planning: planning.data }),
		revision,
		flag:
			item.needs_daniel || item.resolved
				? {
						state: item.resolved ? 'resolved' : 'open',
						at: flaggedAt,
						question: safe(item.question),
						...askChoices(item)
					}
				: null,
		notes: notes.map(({ at, node, text }, index) => ({
			id: String(index),
			author: safe(node),
			at,
			text: safe(text)
		})),
		runs: (runs ?? []).map(projectRun)
	};
}

function projectRun(run: TrackerListedRun) {
	return {
		id: String(run.id),
		origin: safe(run.node),
		state: run.state,
		outcome: run.outcome ?? null,
		queuedAt: run.queued_at,
		startedAt: run.started_at ?? null,
		endedAt: run.ended_at ?? null
	};
}

function safe(text: string | null): string {
	return sanitizeTrackerText(text ?? '');
}

/** A Mac item carries the ask's options the same way the phone replica does. */
function askChoices(item: TrackerItem) {
	const options = (item.options ?? []).map(({ label, effect, recommended }) => ({
		label: safe(label),
		effect: safe(effect),
		...(recommended && { recommended: true as const })
	}));
	const confirm = ['deploy', 'money', 'secret'].find((kind) => kind === item.confirm);
	return {
		...(options.length >= 2 && { options }),
		...(options.length >= 2 && confirm && { confirm: confirm as InboxConfirmKind }),
		...(options.length >= 2 && item.attachments && { attachments: item.attachments })
	};
}
