<!-- @harness-tier page -->
<!-- @harness-atoms ../../../../reports/src/components/shared-primitives/atoms -->
<!-- @harness-uid u_yd5wcp6sz3 -->
<!-- @harness-view overview -->
<script lang="ts">
	import { page } from '$app/state';
	import ProjectOverview from '$shared/projects-sessions/project-overview/ProjectOverview.svelte';
	import Notice from '$shared/explorer-ui/explorer-kit/Notice.svelte';
	import DeliveredFeatures from '../../components/projects-sessions/DeliveredFeatures.svelte';
	import HubFrame from '../../components/shared-primitives/HubFrame.svelte';
	import LoginPanel from '../../components/accounts-access/login-panel/LoginPanel.svelte';
	import { browserContext } from '../../utils/development-tooling/browserContext';
	import { readOverview, watchWhileVisible } from './overviewClient';
	import type { OverviewOutcome } from './overviewClient.types';
	const { session } = browserContext();
	/** Who the server names now; a change to another account clears what was read for the last. */
	const actor = $derived(session.actor?.id ?? null);
	let outcome = $state<OverviewOutcome | null>(null);
	const project = $derived(page.url.searchParams.get('project') || undefined);
	/** Counts reads; an answer to an earlier read, or one for another account, is dropped. */
	let asked = 0;
	let controller: AbortController | undefined;
	async function read(id: string) {
		const turn = ++asked;
		controller?.abort();
		controller = new AbortController();
		const value = await readOverview(fetch, controller.signal);
		if (turn === asked && id === actor) outcome = value;
	}
	/** Asks the session again first: a different or missing account is never read for. */
	async function refresh() {
		const before = actor;
		await session.check();
		if (before && actor === before) await read(before);
	}
	$effect(() => {
		const id = actor;
		outcome = null;
		if (!id) return;
		void read(id);
		const stop = watchWhileVisible(() => void refresh());
		return () => {
			asked++;
			controller?.abort();
			stop();
		};
	});
</script>

<!-- The harness-build slot lives in app.html; `verify stamp` writes the build identity there. -->
<svelte:head>
	<title>Harness · Project overview</title>
</svelte:head>
<HubFrame>
	{#if !session.actor}
		<LoginPanel reason="Sign in with Google to see the Project Overview." />
	{:else if outcome?.kind === 'denied'}
		<Notice as="div" className="po-notice" role="alert"
			>This account cannot read the Project Overview.</Notice
		>
	{:else if outcome?.kind === 'failed'}
		<Notice as="div" className="po-notice" role="alert"
			>The Project Overview could not be read. It is read again while this page is open.</Notice
		>
	{:else}
		<ProjectOverview
			snapshot={outcome?.kind === 'owner' ? outcome.snapshot : null}
			{project}
			standalone={false}
		>
			{#snippet deliveries()}
				{#if outcome?.kind === 'owner' && project}
					{#key project}<DeliveredFeatures {project} />{/key}
				{/if}
			{/snippet}
		</ProjectOverview>
	{/if}
</HubFrame>
