// @harness-uid u_pfflsnhfco
import { getContext, setContext, untrack } from 'svelte';
import { listedHomeSnapshot } from '$reports/lib/projects-sessions/hub-home/homeDirectAgents';
import type {
	HomeChatInput,
	HomeChatReceipt
} from '$reports/lib/projects-sessions/hub-home/hubHome.types';
import type { HostedBrowser } from '../../utils/development-tooling/browserContext';
import { followHubUpdates, liveReadMs } from '../../lib/networking-security/hubLiveUpdates';
import { watchWhileVisible } from '../../routes/tracker-overview/overviewClient';
import { homeSnapshot } from './hubHomeClient';
import { hubHomeReads } from './hubHomeReads';
import type { HubHomeReads } from './hubHomeReads.types';
import type { HubHomeSource, Reading, Readings } from './hubHomeSource.types';

export type { HubHomeSource } from './hubHomeSource.types';

const sourceKey = Symbol('hub-home-source');

function refreshAll(state: Readings, reading: Reading) {
	if (!reading.reads) return;
	state.now = reading.readAllAt = Date.now();
	reading.reads.read();
	for (const listener of reading.listeners) listener();
}

/** Reads for one signed-in account until the returned stop is called. */
function readFor(browser: HostedBrowser, state: Readings, reading: Reading) {
	const { api, session } = browser;
	const reads = hubHomeReads({
		api,
		actor: () => session.actor?.id,
		home: (result) => ((state.home = result), (state.now = Date.now())),
		linked: (result) => ((state.live = result), (state.now = Date.now()))
	});
	reading.reads = reads;
	refreshAll(state, reading);
	const stop = watchWhileVisible(() => {
		const pushed = state.link === 'live' && Date.now() - reading.readAllAt < liveReadMs;
		const actor = session.actor?.id;
		void session.check().then(() => {
			// Change notices cover the stored Home only: linked computers are asked every turn.
			if (!actor || session.actor?.id !== actor) return;
			if (pushed) reads.computers();
			else refreshAll(state, reading);
		});
	});
	return () => {
		reads.close();
		stop();
		reading.reads = null;
		state.home = state.live = null;
	};
}

function sourceActions(browser: HostedBrowser, state: Readings, reading: Reading) {
	return {
		/** Without a reading there is nothing to send through, so the message is not accepted. */
		async send(message: HomeChatInput): Promise<HomeChatReceipt> {
			return reading.reads?.send(message) ?? { id: message.id, status: 'refused' };
		},
		receipt: (id: string) => browser.api.get<HomeChatReceipt>('/api/hub-home/chat', { id }),
		readDocument: (async (request) =>
			(await reading.reads?.readDocument(request)) ?? null) as HubHomeReads['readDocument'],
		refresh: () => refreshAll(state, reading),
		setControlled(controlled: string[]) {
			if (state.home) state.home = { ...state.home, controlled };
		},
		reread: () => reading.reads?.read(),
		onRefresh(listener: () => void) {
			reading.listeners.add(listener);
			// A page that arrives after the reading began has missed its first beat.
			if (reading.reads) listener();
			return () => void reading.listeners.delete(listener);
		}
	};
}

/**
 * Held by the layout, so every page shares one reading and one connection to each linked
 * computer. It reads only while `wanted` names a signed-in account.
 */
export function provideHubHomeSource(
	browser: HostedBrowser,
	wanted: () => string | undefined
): HubHomeSource {
	const state = $state<Readings>({ home: null, live: null, link: null, now: Date.now() });
	const reading: Reading = { reads: null, readAllAt: 0, listeners: new Set() };
	const controlled = $derived(state.home?.controlled ?? []);
	const raw = $derived(state.live?.snapshot ?? homeSnapshot(state.home));
	const snapshot = $derived(raw ? listedHomeSnapshot(raw, controlled) : null);
	const account = $derived(wanted());
	const pushes = $derived(Boolean(state.home?.granted && state.home.live));
	$effect(() => {
		if (!account) return;
		// Only the account restarts the reading; what the reading changes must not.
		return untrack(() => readFor(browser, state, reading));
	});
	$effect(() => {
		if (!pushes) return;
		const stop = followHubUpdates({
			changed: () => ((state.now = Date.now()), reading.reads?.read()),
			state: (link) => (state.link = link)
		});
		return () => {
			stop();
			state.link = null;
		};
	});
	return setContext<HubHomeSource>(sourceKey, {
		get home() {
			return state.home;
		},
		get live() {
			return state.live;
		},
		get link() {
			return state.link;
		},
		get now() {
			return state.now;
		},
		get snapshot() {
			return snapshot;
		},
		get controlled() {
			return controlled;
		},
		...sourceActions(browser, state, reading)
	});
}

export function hubHomeSource(): HubHomeSource {
	return getContext<HubHomeSource>(sourceKey);
}
