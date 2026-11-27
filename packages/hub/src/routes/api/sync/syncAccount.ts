import type { SyncCall, SyncDeps } from './syncPolicy.types';

const origin = 'https://sync.internal';

/** The account's object in the relay Worker, or null when the binding is not there. */
export function accountObject(deps: SyncDeps, account: string): DurableObjectStub | null {
	return deps.accounts ? deps.accounts.get(deps.accounts.idFromName(account)) : null;
}

/** A call to the account object. The path and body are the Hub's own, never a client's. */
export function askAccount(
	call: SyncCall,
	path: string,
	init: RequestInit = {}
): Promise<Response> | null {
	const stub = accountObject(call.deps, call.account);
	return stub ? stub.fetch(origin + path, init) : null;
}

/** Tells the viewers of a scope that it changed. A viewer that misses it catches up on its next read. */
export async function pokeScope(
	call: SyncCall,
	scope: string,
	seq: number,
	kind: string
): Promise<void> {
	try {
		await askAccount(call, '/poke', {
			method: 'POST',
			body: JSON.stringify({ scope, seq, kind })
		});
	} catch {
		// The write is stored; only the live notice is lost.
	}
}

/** Tells every open app of the account that a topic changed. The notice carries no content. */
export async function ringAccount(
	accounts: DurableObjectNamespace | null | undefined,
	account: string,
	topic: 'home' | 'chat'
): Promise<void> {
	if (!accounts) return;
	try {
		const stub = accountObject({ accounts } as SyncDeps, account);
		await stub?.fetch(origin + '/changed', { method: 'POST', body: JSON.stringify({ topic }) });
	} catch {
		// The write is stored; apps without the notice read it on their next poll.
	}
}
