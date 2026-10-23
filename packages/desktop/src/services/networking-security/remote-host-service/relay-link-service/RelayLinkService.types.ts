import type { RelayHostCommand } from '../../../../../../remote/src/index';
import type { RemoteSocket } from '../../../../../../remote/src/index';
import type { RelayHostFrame } from '../../../../../../remote/src/index';

export type RelayLinkState = 'connecting' | 'online' | 'offline';

export type Without<T, K extends string> = T extends unknown ? Omit<T, K> : never;

/** A command the relay acknowledges; the link adds its `ref`. */
export type RelayCommandInput = Without<Extract<RelayHostCommand, { ref: string }>, 'ref'>;

export interface RelayLinkOptions {
	open: (url: string, headers: Record<string, string>) => RemoteSocket;
	origin: string;
	hostId: string;
	credential: string;
	onFrame: (frame: RelayHostFrame) => void;
	onState: (state: RelayLinkState) => void;
	retryMs?: number[];
	pingMs?: number;
	idleMs?: number;
	ackMs?: number;
}

export type Timer = ReturnType<typeof setTimeout>;

export interface Waiting {
	resolve: () => void;
	reject: (error: Error) => void;
	timer: Timer;
}
