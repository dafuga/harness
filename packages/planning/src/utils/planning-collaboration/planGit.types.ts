import type { Buffer } from 'node:buffer';

export interface Git {
	root: string;
	dir: string;
	transactionHead?: string;
	/** The object format the repository itself states; absent when Git states none known here. */
	objectFormat?: 'sha1' | 'sha256';
	run(args: string[], input?: Uint8Array | string, env?: Record<string, string>): Promise<Buffer>;
}
