// @harness-uid u_fprc5ohvkc
import type {
	XDigestOutbox,
	XDigestState,
	XFeeds,
	XReadResult
} from '../../core/agents-providers/xDigest.types';

export interface XDigestPorts {
	reader: { read(scan: number): Promise<XReadResult> };
	state: { load(): Promise<XDigestState>; save(state: XDigestState): Promise<void> };
	outbox: { write(entry: XDigestOutbox): Promise<void> };
	/** Raises one question for Daniel. */
	ask(question: string): Promise<void>;
	attended(): boolean;
	now?: () => Date;
}

export interface XDigestRunOptions {
	dryRun?: boolean;
	/** Collects even when today's digest was already queued. */
	force?: boolean;
}

export type XDigestSelection = XFeeds;
