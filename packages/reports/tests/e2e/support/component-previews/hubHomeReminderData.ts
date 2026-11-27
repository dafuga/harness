import { NOW } from '../projectOverviewFixture';

export function catalogStamp(hours: number) {
	return new Date(NOW + hours * 3_600_000).toISOString();
}

/** One reminder already due and one that repeats. */
export const catalogReminders = [
	{
		itemId: 'preview-snacks',
		title: 'Buy snacks for the sample picnic',
		at: catalogStamp(-2),
		repeats: null,
		updatedAt: catalogStamp(-3)
	},
	{
		itemId: 'preview-plant',
		title: 'Water the sample plant',
		at: catalogStamp(52),
		repeats: 'Weekly',
		updatedAt: catalogStamp(-3)
	}
];
