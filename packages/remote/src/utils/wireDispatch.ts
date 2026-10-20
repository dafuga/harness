import type { RemoteError, RemoteLimits, RemoteMethod, WireRequest } from '../models/Remote.types';
import type { ResponseLedgerService } from '../services/wire-session-service/ResponseLedgerService';

export interface WireDispatchContext {
	attached: boolean;
	/** What this connection may call right now. */
	methods: readonly RemoteMethod[];
	/** Requests of this connection still being answered, not counting this one. */
	pending: number;
	limits: RemoteLimits;
	ledger: ResponseLedgerService;
	handle: (request: WireRequest) => Promise<unknown>;
	explain: (error: unknown) => RemoteError;
	/** The epoch of the session, and whether a mutation must name it to be performed. */
	epoch?: string;
	bound?: boolean;
}

export { wireDispatch } from '../services/wire-session-service/wireDispatch';
