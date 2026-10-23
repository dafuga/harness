export interface ServedRuntime {
	url: string;
	close(): Promise<void>;
}

export interface ServeOptions {
	port: number;
	/** Loopback unless a host is given deliberately; the server has no authentication. */
	host?: string;
}
