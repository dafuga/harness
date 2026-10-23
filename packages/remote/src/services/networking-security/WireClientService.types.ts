import type { AttachInput } from '../../models/networking-security/Remote.types';
import type { WireRequest } from '../../models/networking-security/Remote.types';

export interface WireClientOptions {
	client: AttachInput['client'];
	/** How long a request waits for its answer, across reconnects. */
	deadlineMs?: number;
	uuid?: () => string;
}

export type Listener = (value: unknown) => void;

export interface Waiting {
	request: WireRequest;
	resolve: (value: unknown) => void;
	reject: (error: Error) => void;
	timer: ReturnType<typeof setTimeout>;
}
