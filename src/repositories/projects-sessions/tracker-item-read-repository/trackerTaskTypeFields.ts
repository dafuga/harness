// @harness-uid u_xba7ieg4je
import {
	isTrackerTaskType,
	trackerTaskType
} from '../../../utils/agents-providers/trackerTaskType';
import { trackerBrief } from '../../../utils/projects-sessions/trackerBrief';
import type { TrackerItem, TrackerItemRow } from '../TrackerItemReadRepository.types';

/** The task type and explicit model of a work item; reminders, plans and goals have neither. */
export function trackerTaskTypeFields(
	row: TrackerItemRow,
	notes: TrackerItem['notes_log']
): Pick<TrackerItem, 'task_type' | 'task_type_inferred' | 'explicit_model'> {
	if ((row.kind ?? 'task') !== 'task' && row.kind !== 'recurring') return {};
	return {
		task_type: trackerTaskType({
			...row,
			sensitive: Boolean(Number(row.sensitive)),
			brief: trackerBrief(notes)
		}),
		task_type_inferred: !isTrackerTaskType(row.task_type),
		...(row.explicit_model && { explicit_model: row.explicit_model })
	};
}
