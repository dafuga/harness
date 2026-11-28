<!-- @harness-tier organism -->
<!-- @harness-atoms ../../shared-primitives/atoms -->
<!-- @harness-uid u_z35itvtg7u -->
<script lang="ts">
	import { MediaQuery } from 'svelte/reactivity';
	import { slide } from 'svelte/transition';
	import EmptyState from '$reports/components/explorer-ui/explorer-kit/EmptyState.svelte';
	import type { HomeLiveOverview } from '$reports/lib/projects-sessions/hub-home/homeLive.types';
	import type { HomePastDue } from '$reports/lib/projects-sessions/hub-home/hubHome.types';
	import type { LinkedHome } from '$reports/lib/projects-sessions/hub-home/homeLive.types';
	import { liveNotice, liveSummary, liveSystemNotice } from './hubHomeLive';
	import HubHomeLiveProject from './HubHomeLiveProject.svelte';
	import { count } from './hubHomePresentation';
	import { runTime } from './hubHomeTime';

	let {
		reading = null,
		now,
		local,
		pastDue = []
	}: {
		reading?: LinkedHome | null;
		now: number;
		local?: HomeLiveOverview;
		pastDue?: HomePastDue[];
	} = $props();
	const notice = $derived(local ? null : liveNotice(reading));
	const overview = $derived(local ?? (notice ? null : reading?.snapshot?.liveOverview));
	const dueById = $derived(new Map(pastDue.map((run) => [run.id, run])));
	let allProjects = $state(false);
	const reduceMotion = new MediaQuery('(prefers-reduced-motion: reduce)');
	const projects = $derived(overview?.projects ?? []);
	const running = $derived(projects.filter((project) => project.running > 0));
	const others = $derived(projects.filter((project) => project.running === 0));
	const waiting = $derived(
		others.filter(({ counts }) => counts.blocked || counts.open || counts.in_progress)
	);
	const idle = $derived(
		others.filter(({ counts }) => !counts.blocked && !counts.open && !counts.in_progress)
	);
</script>

{#snippet list(items: HomeLiveOverview['projects'])}
	{#each items as project (project.agent)}
		<HubHomeLiveProject {project} {now} {dueById} />
	{/each}
{/snippet}

<hx-section class="hh-live-overview" aria-labelledby="hh-live-title">
	<hx-div class="hh-live-top">
		<hx-h2 class="hh-needs-title" id="hh-live-title">Live overview</hx-h2>
		{#if overview}
			<hx-p class="hh-live-summary" role="status">{liveSummary(overview)}</hx-p>
			<hx-p class="hh-live-source">
				{#if local}From Tracker on this Mac{:else if reading}
					From {reading.answered} of {count(reading.linked, 'linked computer')} over an encrypted connection
				{/if}
				· read {runTime(overview.readAt)}
			</hx-p>
		{/if}
	</hx-div>
	{#if notice}
		<EmptyState as="div" className="po-empty hh-empty"
			><hx-p>{liveSystemNotice(reading) ? 'Live overview is unavailable.' : notice}</hx-p
			></EmptyState
		>
	{:else if overview && !overview.projects.length}
		<EmptyState as="div" className="po-empty hh-empty"
			><hx-p>Tracker has no projects yet.</hx-p></EmptyState
		>
	{:else if overview}
		{#if running.length}{@render list(running)}
		{:else}<hx-p class="po-sessions">No projects have a running session.</hx-p>{/if}
		{#if others.length}
			<hx-button
				type="button"
				class="po-action hh-projects-toggle"
				aria-expanded={allProjects}
				onclick={() => (allProjects = !allProjects)}
			>
				{allProjects ? 'Show running projects only' : `See all projects (${projects.length})`}
			</hx-button>
			{#if allProjects}
				<hx-div
					class="hh-live-more-projects"
					transition:slide={{ duration: reduceMotion.current ? 0 : 200 }}
				>
					{#if waiting.length}<hx-h3 class="po-band-title">Blocked or open</hx-h3>{@render list(
							waiting
						)}{/if}
					{#if idle.length}<hx-h3 class="po-band-title">Nothing in motion</hx-h3>{@render list(
							idle
						)}{/if}
				</hx-div>
			{/if}
		{/if}
		{#if overview.hiddenRuns}
			<hx-p class="po-sessions"
				>{count(overview.hiddenRuns, 'live run')} of private items counted by Tracker and not shown.</hx-p
			>
		{/if}
		{#if overview.omittedRows}
			<hx-p class="po-sessions"
				>{count(overview.omittedRows, 'more row')} not listed. See Tracker on your Mac.</hx-p
			>
		{/if}
	{/if}
</hx-section>
