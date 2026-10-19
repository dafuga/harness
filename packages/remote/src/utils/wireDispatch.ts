import { RemoteFailure, mutationMethods, remoteErrorMessages } from '../models/Remote.types';
import type {
	RemoteError,
	RemoteErrorCode,
	RemoteLimits,
	RemoteMethod,
	WireRequest,
	WireResponse
} from '../models/Remote.types';
import type { ResponseLedgerService } from '../services/ResponseLedgerService';
import { requestDigest } from './remoteIdentity';

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

function refusal(context: WireDispatchContext, request: WireRequest): RemoteErrorCode | null {
	if (!context.attached) return 'not-attached';
	if (!context.methods.includes(request.method)) return 'method-denied';
	if (context.pending >= context.limits.pendingRequests) return 'too-many-requests';
	return stale(context, request) ? 'request-expired' : null;
}
/** A change issued under another epoch may already have been made there: it is never made here. */
function stale(context: WireDispatchContext, request: WireRequest): boolean {
	const change = context.bound === true && mutationMethods.includes(request.method);
	return change && request.input.epoch !== context.epoch;
}
function failed(id: string, error: RemoteError): WireResponse {
	return { type: 'response', id, ok: false, error: { code: error.code, message: error.message } };
}
/** The work keeps running after a deadline; a re-send of a mutation joins it through the ledger. */
function within<T>(work: Promise<T>, milliseconds: number): Promise<T> {
	return new Promise((resolve, reject) => {
		const timer = setTimeout(() => reject(new RemoteFailure('deadline')), milliseconds);
		const settle = () => clearTimeout(timer);
		work.then(resolve, reject).then(settle, settle);
	});
}
async function perform(context: WireDispatchContext, request: WireRequest): Promise<unknown> {
	const run = () => Promise.resolve().then(() => context.handle(request));
	if (!mutationMethods.includes(request.method))
		return within(run(), context.limits.requestDeadlineMs);
	const entry = { id: request.id, digest: await requestDigest(request) };
	return within(context.ledger.run(entry, run), context.limits.mutationDeadlineMs);
}
/**
 * Answers one validated request: policy first, then the handler, once per id for mutations.
 * Nothing thrown by a handler leaves here except as a declared failure or an explained one.
 */
export async function wireDispatch(
	context: WireDispatchContext,
	request: WireRequest
): Promise<WireResponse> {
	const refused = refusal(context, request);
	if (refused) return failed(request.id, { code: refused, message: remoteErrorMessages[refused] });
	try {
		const value = await perform(context, request);
		return { type: 'response', id: request.id, ok: true, value: value ?? null };
	} catch (error) {
		return failed(request.id, error instanceof RemoteFailure ? error : context.explain(error));
	}
}
