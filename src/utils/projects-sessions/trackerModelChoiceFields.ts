// @harness-uid u_4pgfvaopdt
import { isTrackerTaskType } from '../agents-providers/trackerTaskType';
import { trackerTaskTypes } from '../agents-providers/classifyTrackerTask.types';
import type { TrackerItemInput, TrackerItemValue } from './normalizeTrackerItemFields.types';
import { trackerItemError } from './trackerItemError';

/**
 * Record a --model as the operator's explicit choice, and read a task type given with --kind.
 * `--kind auto` goes back to the inferred type. Item kinds such as task or plan pass through.
 */
export function trackerModelChoiceFields(
	fields: TrackerItemInput,
	body: TrackerItemInput
): Record<string, TrackerItemValue> {
	const choice: Record<string, TrackerItemValue> = {};
	if (fields.model !== undefined) choice.explicit_model = fields.model;
	const named = body.task_type ?? (isTaskTypeWord(fields.kind) ? fields.kind : undefined);
	if (named === undefined) return choice;
	choice.task_type = taskTypeValue(named);
	if (isTaskTypeWord(fields.kind)) choice.kind = undefined;
	return choice;
}

function isTaskTypeWord(value: TrackerItemValue) {
	return value === 'auto' || isTrackerTaskType(value);
}

function taskTypeValue(value: TrackerItemValue) {
	if (value === null || value === '' || value === 'auto') return null;
	if (isTrackerTaskType(value)) return value;
	throw trackerItemError(`task type must be auto or one of ${trackerTaskTypes.join(', ')}`);
}
