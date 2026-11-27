<!-- @harness-tier organism -->
<!-- @harness-atoms ../../shared-primitives/atoms -->
<!-- @harness-uid u_yo3goi2ees -->
<script lang="ts">
	import EmptyState from '$reports/components/explorer-ui/explorer-kit/EmptyState.svelte';
	import { statusLabel } from '$reports/components/projects-sessions/project-overview/projectOverviewPresentation';
	import { workSummary, workEta } from './hubHomePresentation';
	import type { HomeWorkView } from '$reports/lib/projects-sessions/hub-home/homeLive.types';
	import type { OpenHomeSection } from '$reports/lib/projects-sessions/hub-home/hubHome.types';
	import HubHomeCard from './HubHomeCard.svelte';
	import HubHomeNotStarted from './HubHomeNotStarted.svelte';
	import HubHomeRow from './HubHomeRow.svelte';
	import HubHomeSkeleton from './HubHomeSkeleton.svelte';

	let {
		view,
		open
	}: {
		view: HomeWorkView;
		open: OpenHomeSection;
	} = $props();
</script>

{#snippet empty(text: string, action?: string)}
	<EmptyState as="div" className="po-empty hh-empty"
		><hx-p>{text}</hx-p>
		{#if action && view.agents?.some((agent) => agent.itemId)}<hx-button
				type="button"
				class="po-action"
				onclick={() => open('agents')}>{action}</hx-button
			>{/if}
	</EmptyState>
{/snippet}

<HubHomeCard
	section="wip"
	total={view.trackerConnected ? view.work.length : undefined}
	summary={view.overview === null
		? 'Loading work…'
		: !view.trackerConnected
			? 'No work data'
			: view.work.length
				? 'Soonest to finish first'
				: 'All clear'}
	open={() => open('wip')}
>
	{#if view.overview === null}
		<HubHomeSkeleton />
	{:else if !view.trackerConnected}
		{@render empty('Work in progress appears when Tracker data is available.')}
	{:else if view.work.length}
		<hx-p class="hh-wip-line">{workSummary(view.work)}</hx-p>
		<hx-ul class="po-items">
			{#each view.work.slice(0, 8) as item, index (item.id)}
				{@const eta = workEta(item, view.now)}
				<HubHomeRow
					title={item.title}
					meta={eta.tone === 'current'
						? item.project
						: `${item.project} · ${statusLabel(item.status)}`}
					extra={index >= 2}
					wide={index >= 4}
				>
					{#snippet trailing()}<hx-span class="po-eta" data-tone={eta.tone}>{eta.text}</hx-span
						>{/snippet}
				</HubHomeRow>
			{/each}
		</hx-ul>
	{:else if !view.pastDue.length}
		{@render empty(
			'No work in progress. Tasks agents pick up appear here, soonest to finish first.'
		)}
	{/if}
	<HubHomeNotStarted pastDue={view.pastDue} work={view.work} limit={4} />
</HubHomeCard>
