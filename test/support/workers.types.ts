export interface LocalWorker {
	url: string;
	/** Everything Wrangler and workerd printed so far. */
	output(): string;
	stop(): Promise<void>;
}
