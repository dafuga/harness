// @harness-uid u_edh24hc4bb
import { onMount, tick, untrack } from 'svelte';
import { replaceState } from '$app/navigation';
import { resolve } from '$app/paths';
import { needsTarget } from './hubHomeNeedsTarget';
import type { OpenHomeCosAsk } from '$reports/components/projects-sessions/hub-home/hubHomeChatContext.types';
import type { NeedsLinkHome } from './followNeedsLink.svelte.types';

/** The linked computers answer within this; after it, the list is shown as it stands. */
const patienceMs = 20_000;

/** Used once: a reload of the page must not reopen the chat. */
function forgetAddress() {
	if (new URL(location.href).searchParams.has('needs')) replaceState(resolve('/'), {});
}

async function showList(close: (() => void) | null) {
	close?.();
	await tick();
	const list = document.getElementById('hh-needs-title')?.closest('section');
	list?.scrollIntoView({ block: 'start' });
	// The row that opens the chat, never one of its answer buttons: Enter must not answer.
	list?.querySelector<HTMLElement>('.hh-needs-talk')?.focus({ preventScroll: true });
}

async function showAsk(itemId: string, openAsk: OpenHomeCosAsk, close: (() => void) | null) {
	close?.();
	await tick();
	const trigger = document.getElementById(`hh-ask-${itemId}`);
	if (trigger) openAsk(trigger, itemId);
}

/** Hears the address a notification opened, and the worker's message to an open tab. */
function listen(follow: (needs: string) => void, reload: () => void) {
	const named = new URL(location.href).searchParams.get('needs');
	if (named) follow(named);
	const hear = ({ data }: MessageEvent) => {
		if (data?.type !== 'harness:needs-you' || typeof data.needs !== 'string') return;
		follow(data.needs);
		// An open tab may not have read the new decision yet.
		reload();
	};
	const worker = 'serviceWorker' in navigator ? navigator.serviceWorker : null;
	worker?.addEventListener('message', hear);
	worker?.startMessages();
	return () => worker?.removeEventListener('message', hear);
}

/**
 * Takes a clicked notification to Chief of Staff chat, or to the needs-you list. Call it
 * while Home initialises; `home` is read again as Home's asks arrive.
 */
export function followNeedsLink(home: () => NeedsLinkHome): void {
	let needs = $state<string | null>(null);
	let waited = $state(false);
	let timer: ReturnType<typeof setTimeout> | undefined;

	function follow(value: string) {
		clearTimeout(timer);
		waited = false;
		needs = value;
		timer = setTimeout(() => (waited = true), patienceMs);
	}

	onMount(() => {
		const stop = listen(follow, () => home().reload());
		return () => {
			clearTimeout(timer);
			stop();
		};
	});

	$effect(() => {
		const target = needsTarget(needs, home().asks, waited);
		if (target.kind === 'wait') return;
		untrack(() => {
			clearTimeout(timer);
			needs = null;
			forgetAddress();
			const { openAsk, close, dialog } = home();
			if (target.kind === 'ask') void showAsk(target.itemId, openAsk, dialog ? close : null);
			else if (target.kind === 'list') void showList(dialog ? close : null);
		});
	});
}
