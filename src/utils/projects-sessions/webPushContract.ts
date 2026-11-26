// @harness-uid u_vcpbpha6lw
/** What the Hub and the Tracker sender must agree on. */
export const webPushContract = {
	quietTimeZone: 'Europe/Lisbon',
	defaultQuietHours: { enabled: true, start: '22:00', end: '08:00' },
	/** The audience-bound request the sender signs to read subscriptions from the Hub. */
	senderTokenType: 'harness-push-sender+jwt',
	senderSubject: 'harness-push-sender',
	maxSubscriptions: 20
} as const;
