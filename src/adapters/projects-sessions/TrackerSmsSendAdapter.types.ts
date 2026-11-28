export interface TrackerSmsSendAdapterConfig {
	accountSid: string;
	keySid: string;
	from: string;
	destinations: readonly string[];
	readKeySecret: (signal: AbortSignal) => Promise<string>;
	fetcher?: typeof fetch;
}
