<!-- @harness-tier organism -->
<!-- @harness-atoms ../../../../reports/src/components/shared-primitives/atoms -->
<!-- @harness-uid u_z35itvtg7u -->
<script lang="ts">
	import EmptyState from '$reports/components/explorer-ui/explorer-kit/EmptyState.svelte';
	import type { HomeLiveOverview } from '$reports/lib/projects-sessions/hub-home/homeLive.types';
	import type { HomePastDue } from '$reports/lib/projects-sessions/hub-home/hubHome.types';
	import type { LinkedHome } from '../../services/networking-security/LinkedHomeService';
	import { liveNotice, liveSummary, liveSystemNotice } from './hubHomeLive';
	import HubHomeLiveProject from './HubHomeLiveProject.svelte';
	import { count } from './hubHomePresentation';
	import { runTime } from './hubHomeTime';

	let {
		reading = null,
		now,
		native,
		pastDue = []
	}: {
		reading?: LinkedHome | null;
		now: number;
		native?: HomeLiveOverview;
		pastDue?: HomePastDue[];
	} = $props();
	const notice = $derived(native ? null : liveNotice(reading));
	const overview = $derived(native ?? (notice ? null : reading?.snapshot?.liveOverview));
	const dueById = $derived(new Map(pastDue.map((run) => [run.id, run])));
</script>

<hx-section class="hh-live-overview" aria-labelledby="hh-live-title">
	<hx-div class="hh-live-top">
		<hx-h2 class="hh-needs-title" id="hh-live-title">Live overview</hx-h2>
		{#if overview}
			<hx-p class="hh-live-summary" role="status">{liveSummary(overview)}</hx-p>
			{#if reading}<hx-p class="hh-live-source"
					>From {reading.answered} of {count(reading.linked, 'linked computer')} over an encrypted connection
					· read {runTime(overview.readAt)}</hx-p
				>{/if}
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
		{#each overview.projects as project (project.agent)}
			<HubHomeLiveProject {project} {now} {dueById} />
		{/each}
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
