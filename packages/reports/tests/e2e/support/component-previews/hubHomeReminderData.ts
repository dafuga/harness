import { NOW } from '../projectOverviewFixture';

export function catalogStamp(hours: number) {
	return new Date(NOW + hours * 3_600_000).toISOString();
}

/** One work reminder already overdue and one personal one that repeats. */
export const catalogReminders = [
	{
		itemId: 'preview-snacks',
		title: 'Renew the sample sign-in',
		at: catalogStamp(-2),
		repeats: null,
		group: 'work' as const,
		project: 'sample-hub',
		updatedAt: catalogStamp(-3)
	},
	{
		itemId: 'preview-plant',
		title: 'Water the sample plant',
		at: catalogStamp(52),
		repeats: 'Weekly',
		group: 'personal' as const,
		project: null,
		updatedAt: catalogStamp(-3)
	}
];
