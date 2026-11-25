// @harness-uid u_4pgfvaopdt
import type { TrackerItemInput } from './normalizeTrackerItemFields.types';
import type {
	TrackerItemChange,
	TrackerItemMutationContext,
	TrackerItemSnapshot
} from './planTrackerItemMutation.types';
import { classifyTrackerBlocker, escalatesToDaniel } from './classifyTrackerBlocker';
import { guardTrackerDuplicate } from './trackerItemInput';
import { trackerBlockerLabels } from './trackerBlockerTypes';
import { trackerItemError } from './trackerItemError';
import { trackerItemValueOr } from './trackerItemValueOr';

export function trackerBlockItem(
	item: TrackerItemSnapshot,
	body: TrackerItemInput,
	context: TrackerItemMutationContext
): TrackerItemChange {
	const reason = String(trackerItemValueOr(body.reason, '')).trim();
	if (!reason) throw trackerItemError('block reason required');
	const fields = { status: 'blocked', blocked_reason: reason };
	const { type } = classifyTrackerBlocker(reason);
	const escalated = escalatesToDaniel(type);
	const appendNote = `blocked: ${reason}`;
	if (body.needs_daniel === false && !escalated) return { fields, appendNote };
	if (body.needs_daniel === false)
		return {
			fields: { ...fields, needs_daniel: 1, resolved: 0, question: `Blocked: ${reason}` },
			appendNote: `${appendNote}\nescalated to Needs Daniel: ${trackerBlockerLabels[type]} blockers need Daniel`
		};
	guardTrackerDuplicate(context, {
		text: `${item.title} ${reason}`,
		agent: item.agent,
		excludeId: item.id,
		force: body.force,
		askingDaniel: true
	});
	return {
		fields: { ...fields, needs_daniel: 1, resolved: 0, question: `Blocked: ${reason}` },
		appendNote
	};
}
