<!-- @harness-tier organism -->
<!-- @harness-atoms ../../../../reports/src/components/shared-primitives/atoms -->
<!-- @harness-uid u_pkjntjini6 -->
<script lang="ts">
	import { resolve } from '$app/paths';
	import BrandMark from '../../../../reports/src/components/BrandMark.svelte';
	import Pill from '../../../../reports/src/components/explorer-ui/explorer-kit/Pill.svelte';
	import AccountMenu from '../accounts-access/AccountMenu.svelte';
	import { browserContext } from '../../utils/development-tooling/browserContext';
	import {
		homeHeadline,
		lowestLimit,
		providerNames,
		warningFor,
		warningLabel,
		summaryLine
	} from './hubHomePresentation';
	import type { HomeView } from './hubHomeView.types';
	let { view }: { view: HomeView } = $props();
	const { session } = browserContext();
	const warning = $derived(lowestLimit(view.quota ?? []));
	const machines = $derived(view.overview?.status === 'ready' ? view.overview.machines : []);
	let accountOpen = $state(false);
</script>

<hx-header class="hh-topbar">
	<hx-a class="hh-brand" href={resolve('/')}>
		<hx-span class="hh-brand-mark"><BrandMark size={22} /></hx-span> Harness
	</hx-a>
	<hx-span class="hh-crumb">Home</hx-span>
	<hx-div class="hh-account">
		<hx-button
			type="button"
			class="hh-account-trigger"
			aria-label="Account"
			aria-expanded={accountOpen}
			onclick={() => (accountOpen = !accountOpen)}
		>
			<hx-span class="hh-avatar hh-avatar-me" aria-hidden="true"
				>{session.actor?.name.slice(0, 1).toUpperCase()}</hx-span
			>
			<hx-span class="hh-account-name">{session.actor?.name}</hx-span>
		</hx-button>
		{#if accountOpen}<hx-div class="hh-account-menu account"><AccountMenu /></hx-div>{/if}
	</hx-div>
</hx-header>

<hx-header class="po-page hh-page hh-heading">
	<hx-div class="po-head hh-head">
		<hx-p class="po-kicker">Home</hx-p>
		<hx-h1 class="po-title" id="hh-title"
			>{view.agents === null
				? 'Loading your home…'
				: view.trackerConnected
					? homeHeadline(view.agents)
					: 'Tracker is unavailable'}</hx-h1
		>
		<hx-p class="po-totals" role="status"
			>{view.agents === null
				? 'Reading agents, plans, schedules and projects'
				: summaryLine(view.work, view.schedule?.length ?? 0)}</hx-p
		>
		{#if machines.length || warning}
			<hx-ul class="po-machines" aria-label="Computers and quota">
				{#each machines as machine (machine.name)}
					<Pill as="li" tone="po-machine" state={machine.status}>
						<hx-span class="po-machine-mark" aria-hidden="true"></hx-span>
						{machine.name} <hx-span class="po-machine-status">{machine.status}</hx-span>
					</Pill>
				{/each}
				{#if warning}
					<hx-li class="po-machine hh-q-headflag" data-level={warningFor(warning.limit.left)}>
						<hx-span class="hh-q-flag" data-level={warningFor(warning.limit.left)}
							><hx-span class="hh-q-mark" aria-hidden="true"></hx-span>{warningLabel(
								warning.limit
							)}</hx-span
						>
						{providerNames[warning.subscription.provider]}
						{warning.limit.label}
						<hx-span class="po-machine-status">{warning.limit.left}% left</hx-span>
					</hx-li>
				{/if}
			</hx-ul>
		{/if}
	</hx-div>
</hx-header>
