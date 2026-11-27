export interface TrackerGmailSendAdapterConfig {
	account: string;
	readAccessToken(signal: AbortSignal): Promise<string>;
	fetcher?: (...args: Parameters<typeof fetch>) => ReturnType<typeof fetch>;
}

export interface TrackerGmailReply {
	inReplyTo: string;
	references: string[];
}

export interface TrackerGmailMailHeader {
	name: string;
	value: string;
}
