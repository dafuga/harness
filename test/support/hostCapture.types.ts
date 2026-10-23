export interface HostCapture {
	/** What the running server said about itself when it was captured. */
	reported: { buildId: string | null; sdk: { version: string }; host: { revision: string | null } };
	screenshot: Buffer;
}
