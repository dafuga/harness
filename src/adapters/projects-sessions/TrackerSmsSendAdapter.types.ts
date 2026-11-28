// @harness-uid u_bng5whqki7
export interface TrackerSmsSendAdapterConfig {
	accountSid: string;
	keySid: string;
	from: string;
	destinations: readonly string[];
	readKeySecret: (signal: AbortSignal) => Promise<string>;
	fetcher?: (...args: Parameters<typeof fetch>) => ReturnType<typeof fetch>;
}
