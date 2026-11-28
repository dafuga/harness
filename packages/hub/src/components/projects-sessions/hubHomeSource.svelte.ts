// @harness-uid u_r2grlgtbej
// @harness-uid u_dk9h2cwm4x
import { getContext, setContext, untrack } from 'svelte';
import { listedHomeSnapshot } from '$reports/lib/projects-sessions/hub-home/homeDirectAgents';
import type {
	HomeChatInput,
	HomeChatReceipt
} from '$reports/lib/projects-sessions/hub-home/hubHome.types';
import type { ReadHomeResult } from '$reports/components/projects-sessions/hub-home/hubHomeView.types';
import type { RealtimeState } from '$reports/lib/projects-sessions/realtime/realtime.types';
import type { LinkedHome } from '../../services/networking-security/LinkedHomeService';
import type { HostedBrowser } from '../../utils/development-tooling/browserContext';
import { followHubUpdates, liveReadMs } from '../../lib/networking-security/hubLiveUpdates';
import { watchWhileVisible } from '../../routes/tracker-overview/overviewClient';
import { homeSnapshot } from './hubHomeClient';
import { hubHomeReads } from './hubHomeReads';
import { HubHomeNotReadingError } from './HubHomeNotReadingError';
import type { HubHomeReads } from './hubHomeReads.types';
import type { HubHomeSource } from './hubHomeSource.types';

export type { HubHomeSource } from './hubHomeSource.types';

const sourceKey = Symbol('hub-home-source');

interface Readings {
	home: ReadHomeResult | null;
	live: LinkedHome | null;
	link: RealtimeState | null;
	now: number;
}

/** What a signed-in session holds while it reads: its own readers and its last full read. */
interface Reading {
	reads: HubHomeReads | null;
	readAllAt: number;
	listeners: Set<() => void>;
}

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
		async send(message: HomeChatInput) {
			if (!reading.reads) throw new HubHomeNotReadingError();
			return reading.reads.send(message);
		},
		receipt: (id: string) => browser.api.get<HomeChatReceipt>('/api/hub-home/chat', { id }),
		readDocument: (async (request) =>
			(await reading.reads?.readDocument(request)) ?? null) as HubHomeReads['readDocument'],
		refresh: () => refreshAll(state, reading),
		setControlled(controlled: string[]) {
			if (state.home) state.home = { ...state.home, controlled };
		},
		onRefresh(listener: () => void) {
			reading.listeners.add(listener);
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
