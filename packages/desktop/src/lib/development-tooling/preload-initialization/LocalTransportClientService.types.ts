// @harness-uid u_ycbuxdmxoz
import type { CacheStatus } from '../../../models/projects-sessions/ProjectContext.types';
import type { RunEvent } from '../../../models/development-tooling/RunContext.types';
import type { LocalBootstrap, RemoteConnectionEvent } from '../../../../../remote/src/index';

export interface LocalTransportEventMap {
	run: RunEvent;
	cache: CacheStatus;
	connection: RemoteConnectionEvent;
}

/** The WebSocket of a page, or anything shaped like it. */
export interface LocalSocketPort {
	send(text: string): void;
	close(): void;
	onopen: ((event: unknown) => void) | null;
	onmessage: ((event: { data: unknown }) => void) | null;
	onclose: ((event: unknown) => void) | null;
}

export interface LocalTransportClientOptions {
	/** Asks the main process for a ticket. In the app this is the one IPC call of the preload. */
	bootstrap: () => Promise<LocalBootstrap>;
	open: (url: string, protocols: string[]) => LocalSocketPort;
	retryMs?: number[];
	deadlineMs?: number;
}
