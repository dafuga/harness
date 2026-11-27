<!-- @harness-tier organism -->
<!-- @harness-atoms ../../shared-primitives/atoms -->
<!-- @harness-uid u_z35itvtg7u -->
<script lang="ts">
	import EmptyState from '$reports/components/explorer-ui/explorer-kit/EmptyState.svelte';
	import type { LinkedHome } from './hubHomeView.types';
	import type { HomeLiveOverview } from '$reports/lib/projects-sessions/hub-home/homeLive.types';
	import { liveNotice, liveSummary, projectSummary, liveSystemNotice } from './hubHomeLive';
	import HubHomeLiveProject from './HubHomeLiveProject.svelte';
	import { count } from './hubHomePresentation';
	import { runTime } from './hubHomeTime';

	let {
		reading,
		now,
		local
	}: { reading: LinkedHome | null; now: number; local?: HomeLiveOverview } = $props();
	const notice = $derived(local ? null : liveNotice(reading));
	const overview = $derived(local ?? (notice ? null : (reading?.snapshot?.liveOverview ?? null)));
	const moving = $derived(overview?.projects.filter((project) => project.rows.length) ?? []);
	const quiet = $derived(overview?.projects.filter((project) => !project.rows.length) ?? []);
</script>

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
		{#each moving as project (project.agent)}
			<HubHomeLiveProject {project} {now} />
		{/each}
		{#if quiet.length}
			<hx-details class="hh-live-project">
				<hx-summary class="hh-live-head">
					<hx-span class="hh-live-name"
						>{count(quiet.length, 'project')} with nothing in motion</hx-span
					>
				</hx-summary>
				<hx-ul class="hh-live-rows" aria-label="Projects with nothing in motion">
					{#each quiet as project (project.agent)}
						<hx-li class="hh-live-quiet"
							><hx-span class="hh-live-name">{project.agent}</hx-span>
							<hx-span class="hh-live-counts">{projectSummary(project)}</hx-span></hx-li
						>
					{/each}
				</hx-ul>
			</hx-details>
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
