// @harness-uid u_gldjax27wd
/** The analytics path is not under a temporary root, so the fixture refuses to delete it. */
export class NonTemporaryAnalyticsStoreError extends Error {
	override name = 'NonTemporaryAnalyticsStoreError';
}
