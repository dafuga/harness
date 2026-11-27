<!-- @harness-tier organism -->
<!-- @harness-atoms ../../shared-primitives/atoms -->
<!-- @harness-uid u_pkjntjini6 -->
<script lang="ts">
	import { resolve } from '$app/paths';
	import type { Snippet } from 'svelte';
	import Notice from '$reports/components/explorer-ui/explorer-kit/Notice.svelte';
	import { liveSystemNotice } from './hubHomeLive';
	import BrandMark from '$reports/components/BrandMark.svelte';
	import Pill from '$reports/components/explorer-ui/explorer-kit/Pill.svelte';
	import { count, homeHeadline, summaryLine } from './hubHomePresentation';
	import HubHomeQuotaPills from './HubHomeQuotaPills.svelte';
	import type { RealtimeState } from '$reports/lib/projects-sessions/realtime/realtime.types';
	import type { HomeView } from './hubHomeView.types';
	let {
		view,
		link,
		accountName = '',
		accountMenu,
		needsHref = resolve('/') + '?view=needs-you',
		needsOnly = false,
		notifications
	}: {
		view: HomeView;
		link: RealtimeState | null;
		accountName?: string;
		accountMenu?: Snippet;
		needsHref?: string;
		needsOnly?: boolean;
		notifications?: Snippet;
	} = $props();
	const liveSessions = $derived(view.overview?.status === 'ready' ? view.overview.liveSessions : 0);
	const machines = $derived(
		view.computers?.snapshot?.liveOverview?.machines ??
			(view.overview?.status === 'ready' ? view.overview.machines : [])
	);
	const offline = $derived(
		machines.filter((machine) => machine.status === 'offline').map((machine) => machine.name)
	);
	const systemNotice = $derived(liveSystemNotice(view.computers));
	let accountOpen = $state(false);
</script>

<hx-header class="hh-topbar">
	<hx-a class="hh-brand" href={resolve('/')} aria-label="Harness">
		<hx-span class="hh-brand-mark"><BrandMark size={22} /></hx-span>
	</hx-a>
	<hx-span class="hh-crumb">{needsOnly ? 'Needs you' : 'Home'}</hx-span>
	{#if needsHref}
		<!-- Both renderers supply the same query on their home route. -->
		<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
		<hx-a class="po-action hh-inbox-link" href={needsOnly ? resolve('/') : needsHref}>
			{needsOnly ? 'Home' : 'Needs you'}
		</hx-a>
	{/if}
	<hx-div class="hh-account">
		<hx-button
			type="button"
			class="hh-account-trigger"
			aria-label="Account"
			aria-expanded={accountOpen}
			onclick={() => (accountOpen = !accountOpen)}
		>
			<hx-span class="hh-avatar hh-avatar-me" aria-hidden="true"
				>{accountName.slice(0, 1).toUpperCase()}</hx-span
			>
			<hx-span class="hh-account-name">{accountName}</hx-span>
		</hx-button>
		{#if accountOpen}<hx-div class="hh-account-menu account">
				{@render accountMenu?.()}
			</hx-div>{/if}
	</hx-div>
</hx-header>

{#if offline.length || systemNotice || link === 'reconnecting'}
	<hx-div class="po-page hh-page hh-system-alert">
		<Notice as="div" className="po-notice" role="status" label="System alerts">
			{#if offline.length}<hx-p>Offline: {offline.join(', ')}</hx-p>{/if}
			{#if systemNotice}<hx-p>{systemNotice}</hx-p>{/if}
			{#if link === 'reconnecting'}<hx-p role="status" aria-label="Updates" data-state={link}
					>Reconnecting</hx-p
				>{/if}
		</Notice>
	</hx-div>
{/if}

<hx-header class="po-page hh-page hh-heading">
	<hx-div class="po-head hh-head">
		{#if !needsOnly}<hx-p class="po-kicker">Home</hx-p>{/if}
		<hx-h1 class="po-title" id="hh-title"
			>{needsOnly
				? 'Needs you'
				: view.agents === null
					? 'Loading your home…'
					: view.trackerConnected
						? homeHeadline(view.agents, liveSessions, view.openAsks.length)
						: view.needsMac
							? 'Connect your Mac'
							: view.linkedComputers
								? 'Your Mac is offline'
								: 'Your workspace'}</hx-h1
		>
		{#if !needsOnly}<hx-p class="po-totals" role="status"
				>{view.agents === null
					? 'Reading agents, plans, schedules and projects'
					: view.needsMac
						? 'Open Harness on your Mac and sign in with the same Google account.'
						: view.trackerConnected
							? summaryLine(view.work, view.schedule?.length ?? 0)
							: view.linkedComputers
								? 'Open Harness on a linked Mac and its running sessions appear here.'
								: view.native
									? 'Tracker activity could not be read on this Mac.'
									: view.owner
										? 'Check Tracker on your Mac to resume sharing your work.'
										: 'Your shared projects and activity appear here when available.'}</hx-p
			>{/if}
		{#if machines.length}
			<hx-ul class="po-machines" aria-label="Computers">
				{#each machines as machine (machine.name)}
					<Pill as="li" tone="po-machine" state={machine.status}>
						<hx-span class="po-machine-mark" aria-hidden="true"></hx-span>
						{machine.name}
						<hx-span class="po-machine-status"
							>{machine.status}{machine.remoteRuns
								? ` · ${count(machine.remoteRuns, 'remote run')}`
								: ''}</hx-span
						>
					</Pill>
				{/each}
			</hx-ul>
		{/if}
		{#if view.quota?.length}<HubHomeQuotaPills subscriptions={view.quota} now={view.now} />{/if}
		{#if view.owner}{@render notifications?.()}{/if}
	</hx-div>
</hx-header>

<style>
	.hh-inbox-link {
		margin-inline-start: auto;
		white-space: nowrap;
	}
	.hh-inbox-link + .hh-account {
		margin-inline-start: 0;
	}
</style>
