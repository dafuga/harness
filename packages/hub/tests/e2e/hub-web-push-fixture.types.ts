export interface PushFixtureOptions {
	permission: 'default' | 'granted' | 'denied';
	/** What the permission prompt is answered with. */
	answer?: 'default' | 'granted' | 'denied';
	/** The Hub has no key configured, or the person is not the owner. */
	unavailable?: boolean;
}
