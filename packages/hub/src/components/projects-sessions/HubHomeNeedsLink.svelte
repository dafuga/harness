<!-- @harness-tier organism -->
<!-- @harness-atoms ../../../../reports/src/components/shared-primitives/atoms -->
<!-- @harness-uid u_fhjqrozyv5 -->
<!-- Follows a clicked notification: the address it opened, or the worker's message. -->
<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { replaceState } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { needsTarget } from './hubHomeNeedsTarget';
	import type { HomeView, OpenHomeSection } from './hubHomeView.types';

	let {
		view,
		open,
		close,
		reload,
		dialog
	}: {
		view: HomeView;
		open: OpenHomeSection;
		close: () => void;
		reload: () => void;
		dialog: boolean;
	} = $props();
	/** The linked computers answer within this; after it, the list is shown as it stands. */
	const patienceMs = 20_000;
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
		return () => {
			clearTimeout(timer);
			worker?.removeEventListener('message', hear);
		};
	});

	/** Used once: a reload of the page must not reopen the chat. */
	function forget() {
		clearTimeout(timer);
		needs = null;
		if (new URL(location.href).searchParams.has('needs')) replaceState(resolve('/'), {});
	}

	async function showList() {
		if (dialog) close();
		await tick();
		const list = document.getElementById('hh-needs-title')?.closest('section');
		list?.scrollIntoView({ block: 'start' });
		// The row that opens the chat, never one of its answer buttons: Enter must not answer.
		list?.querySelector<HTMLElement>('.hh-needs-row')?.focus({ preventScroll: true });
	}

	$effect(() => {
		const target = needsTarget(needs, view.openAsks, waited);
		if (target.kind === 'wait') return;
		forget();
		if (target.kind === 'ask') open('agents', target.agentId);
		else if (target.kind === 'list') void showList();
	});
</script>
