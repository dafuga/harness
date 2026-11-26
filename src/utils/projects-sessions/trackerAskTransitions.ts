// @harness-uid u_3rvpzml4j7
// @harness-uid u_ask0tr4ns1
import { chosenTrackerAskOption } from './trackerAskOptions';
import { trackerItemError } from './trackerItemError';
import { storedTrackerAttachments } from './storedTrackerAttachments';
import { trackerResolveItem } from './trackerItemInput';
import type {
	TrackerItemChange,
	TrackerItemMutationContext,
	TrackerItemSnapshot
} from './planTrackerItemMutation.types';
import type { TrackerItemInput } from './normalizeTrackerItemFields.types';

/** What a new question stores about its choices: the new ones, or none when it replaces the ask. */
function trackerAskChoiceFields(
	item: TrackerItemSnapshot,
	body: TrackerItemInput
): TrackerItemInput {
	if (body.options !== undefined) {
		const attached = attachmentFields(item, body);
		const choices = { options: body.options, confirm: body.confirm ?? null };
		return { ...choices, ...attached, ...clearedChoice(item) };
	}
	if (body.question) return { ...clearedAsk(item), ...attachmentFields(item, body) };
	return {};
}

/** A new ask keeps only the documents sent with it. */
function attachmentFields(item: TrackerItemSnapshot, body: TrackerItemInput): TrackerItemInput {
	if (body.attachments === undefined && !item.attachments) return {};
	// Stored verbatim: the item write has already validated and packed them.
	return storedTrackerAttachments(body.attachments);
}

/** Clear the old ask's choices, but only when it had some, so plain items write nothing extra. */
function clearedAsk(item: TrackerItemSnapshot): TrackerItemInput {
	return {
		...(item.options || item.confirm ? { options: null, confirm: null } : {}),
		...(item.attachments ? { attachments: null, attachment_docs: null } : {}),
		...clearedChoice(item)
	};
}

function clearedChoice(item: TrackerItemSnapshot): TrackerItemInput {
	return item.answer_option ? { answer_option: null } : {};
}

/** Answer an ask by tapping one of its options, or with free text ("Other"). */
function trackerAnswerItem(
	item: TrackerItemSnapshot,
	body: TrackerItemInput,
	context: TrackerItemMutationContext
): TrackerItemChange {
	if (body.option === undefined) return answerWithText(item, body, context);
	const { index, option } = chosenTrackerAskOption(item.options, body.option);
	if (item.confirm && body.confirmed !== true)
		throw trackerItemError(`this ${item.confirm} ask needs a confirm step`, 409);
	const change = trackerResolveItem(item, { ...body, answer: option.label }, context);
	return {
		...change,
		fields: { ...change.fields, answer_option: String(index + 1) },
		appendNote: `answered with option ${index + 1}: ${option.label}`
	};
}

function answerWithText(
	item: TrackerItemSnapshot,
	body: TrackerItemInput,
	context: TrackerItemMutationContext
): TrackerItemChange {
	if (!body.answer) throw trackerItemError('answer text required');
	const change = trackerResolveItem(item, body, context);
	return { ...change, fields: { ...change.fields, ...clearedChoice(item) } };
}

/** The steps of an item transition that deal with an ask's choices. */
export const trackerAskTransitions = {
	answer: trackerAnswerItem,
	choiceFields: trackerAskChoiceFields,
	cleared: clearedAsk
};
