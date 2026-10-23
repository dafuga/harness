import type { RemoteAttachment } from '../../../models/networking-security/Remote.types';
import type { RemoteMethod } from '../../../models/networking-security/Remote.types';
import type { WireRequest } from '../../../models/networking-security/Remote.types';
import type { RemoteError } from '../../../models/networking-security/Remote.types';
import type { RemoteLimits } from '../../../models/networking-security/Remote.types';

export interface WireSessionOptions {
	role: RemoteAttachment['role'];
	/** What this client may call right now; read again for every request. */
	methods: () => readonly RemoteMethod[];
	describe: () => Pick<RemoteAttachment, 'host' | 'device' | 'grant'>;
	/** Policy and operation of one allowed request. Throw `RemoteFailure` to refuse with a code. */
	handle: (request: WireRequest) => Promise<unknown>;
	/** Turns any other error into public words. By default nothing of the error is shown. */
	explain?: (error: unknown) => RemoteError;
	limits?: Partial<RemoteLimits>;
	epoch?: string;
	/** Mutations must name this session's epoch: one issued before a restart is never run. */
	authority?: boolean;
}

/** One connection of a session. A transport feeds it text frames and closes it when it ends. */
export interface WireLink {
	receive(text: string): Promise<void>;
	close(): void;
}

export interface Sink {
	send: (text: string) => void;
	violation: () => void;
	attached: boolean;
	open: boolean;
	pending: number;
}
