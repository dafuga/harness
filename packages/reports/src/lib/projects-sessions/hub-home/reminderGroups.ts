// @harness-uid u_bnpelpb6nh
import type { ReminderGroup, ReminderGrouped } from './reminderGroups.types';

/**
 * @pure Splits reminders, already soonest first, into Work and Personal. Work is listed by
 * project, the project with the soonest row first. A row without a group is personal.
 */
export function reminderGroups<Row>(
	rows: Row[],
	of: (row: Row) => ReminderGrouped
): ReminderGroup<Row>[] {
	const work = new Map<string, Row[]>();
	const flat: Row[] = [];
	const personal: Row[] = [];
	for (const row of rows) {
		const { group, project } = of(row);
		if (group !== 'work') personal.push(row);
		else {
			flat.push(row);
			const name = project || 'Other';
			work.set(name, [...(work.get(name) ?? []), row]);
		}
	}
	return [
		{
			id: 'work',
			label: 'Work',
			rows: flat,
			sections: [...work].map(([project, listed]) => ({ project, rows: listed })),
			empty: 'No work reminders in the next 14 days.'
		},
		{
			id: 'personal',
			label: 'Personal',
			rows: personal,
			sections: personal.length ? [{ project: null, rows: personal }] : [],
			empty: 'No personal reminders in the next 14 days.'
		}
	];
}
