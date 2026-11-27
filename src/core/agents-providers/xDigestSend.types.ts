// @harness-uid u_qejrsxkryv
export interface XDigestSenderConfig {
	/** The computer that collects, reached over SSH, and its outbox relative to that home. */
	source: { host: string; directory: string };
	slack: {
		installation: {
			installationId: string;
			project: string;
			environment: string;
			workspaceId: string;
			botId: string;
			botUserId: string;
		};
		channel: string;
		/** Where the bot token is read from at send time. This names it and never holds it. */
		secret: { project: string; name: string };
	};
	tracker: { item: string; command: string };
}

export interface XDigestSendState {
	version: 1;
	day?: string;
	/** The first message of that day not yet delivered. */
	next: number;
	closed: boolean;
}

export interface XDigestSendReport {
	status: 'sent' | 'already-sent' | 'waiting' | 'blocked' | 'send-failed';
	messages?: number;
	detail?: string;
}
