<!-- @harness-tier organism -->
<!-- @harness-atoms ../../shared-primitives/atoms -->
<!-- @harness-uid u_fahyrdozii -->
<script lang="ts">
	import EmptyState from '$reports/components/explorer-ui/explorer-kit/EmptyState.svelte';
	import ProjectOverview from '$reports/components/projects-sessions/project-overview/ProjectOverview.svelte';
	import { statusLabel } from '$reports/components/projects-sessions/project-overview/projectOverviewPresentation';
	import { workEta } from './hubHomePresentation';
	import HubHomeNotStarted from './HubHomeNotStarted.svelte';
	import type { HomeWorkView } from '$reports/lib/projects-sessions/hub-home/homeLive.types';
	import HubHomeRow from './HubHomeRow.svelte';
	import HubHomeSkeleton from './HubHomeSkeleton.svelte';
	let {
		overview,
		work,
		pastDue,
		now
	}: Pick<HomeWorkView, 'overview' | 'work' | 'pastDue' | 'now'> = $props();
	let tab = $state<'soonest' | 'projects'>('soonest');
	let done = $state(false);
	const visible = $derived(
		overview?.status === 'ready' && !done
			? { ...overview, projects: overview.projects.filter((project) => project.state !== 'done') }
			: overview
	);
</script>

<hx-div class="hh-tabs" role="group" aria-label="Work view">
	<hx-button
		type="button"
		class="hh-tab"
		aria-pressed={tab === 'soonest'}
		onclick={() => (tab = 'soonest')}>Soonest first</hx-button
	>
	<hx-button
		type="button"
		class="hh-tab"
		aria-pressed={tab === 'projects'}
		onclick={() => (tab = 'projects')}>By project</hx-button
	>
</hx-div>
{#if overview?.status === 'unavailable'}
	<EmptyState as="div" className="po-empty hh-empty"
		>Work in progress appears when Tracker data is available.</EmptyState
	>
{:else if tab === 'projects'}
	{#if overview?.status === 'ready'}
		<hx-button
			type="button"
			class="po-chip hh-show-done"
			aria-pressed={done}
			onclick={() => (done = !done)}>Show done</hx-button
		>
	{/if}
	<hx-div class="hh-overview"><ProjectOverview snapshot={visible} standalone={false} /></hx-div>
{:else if overview === null}
	<HubHomeSkeleton rows={6} />
{:else if !work.length && !pastDue.length}
	<EmptyState as="div" className="po-empty hh-empty">No work is in progress.</EmptyState>
{:else}
	<HubHomeNotStarted {pastDue} {work} />
	<hx-ul class="po-items hh-soonest">
		{#each work as item (item.id)}
			{@const eta = workEta(item, now)}
			<HubHomeRow
				title={item.title}
				meta={eta.tone === 'current'
					? item.project
					: `${item.project} · ${statusLabel(item.status)}`}
			>
				{#snippet trailing()}<hx-span class="po-eta" data-tone={eta.tone}>{eta.text}</hx-span
					>{/snippet}
			</HubHomeRow>
		{/each}
	</hx-ul>
{/if}
