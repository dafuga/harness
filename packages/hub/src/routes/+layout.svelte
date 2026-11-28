<!-- @harness-tier layout -->
<!-- @harness-atoms ../../../reports/src/components/shared-primitives/atoms -->
<!-- @harness-uid u_6bq2jpavns -->
<script lang="ts">
	import { onMount, untrack, type Snippet } from 'svelte';
	import { page } from '$app/state';
	import '$desktop/lib/styles/workspace.css';
	import '$desktop/lib/styles/design.css';
	import '../lib/styles/hub.css';
	import '../lib/styles/hub-list.css';
	import { provideBrowser } from './browserContext';
	let { children }: { children: Snippet } = $props();
	const { session } = provideBrowser();
	onMount(() => void session.refresh());

	$effect(() => {
		const account = session.status?.deviceApproval ? session.identity?.id : null;
		const nativeReturn =
			page.url.pathname.startsWith('/native/') && page.url.searchParams.get('return') === '1';
		if (!account || nativeReturn) return;
		const check = () => {
			const state = session.deviceApproval.result?.state;
			if (!session.busy && (!state || state === 'waiting-for-approval')) void session.checkDevice();
		};
		untrack(check);
		const deviceTimer = setInterval(check, 1500);
		const authTimer = setInterval(() => {
			if (!session.actor && !session.busy) void session.check();
		}, 15_000);
		return () => {
			clearInterval(deviceTimer);
			clearInterval(authTimer);
		};
	});
</script>

{@render children()}
