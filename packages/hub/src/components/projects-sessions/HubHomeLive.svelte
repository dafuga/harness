<!-- @harness-tier organism -->
<!-- @harness-atoms ../../../../reports/src/components/shared-primitives/atoms -->
<!-- @harness-uid u_z35itvtg7u -->
<script lang="ts">
	import EmptyState from '$reports/components/explorer-ui/explorer-kit/EmptyState.svelte';
	import type { LinkedHome } from '../../services/networking-security/LinkedHomeService';
	import { liveNotice, liveSummary, liveSystemNotice } from './hubHomeLive';
	import HubHomeLiveProject from './HubHomeLiveProject.svelte';
	import { count } from './hubHomePresentation';
	import { runTime } from './hubHomeTime';

	let { reading, now }: { reading: LinkedHome | null; now: number } = $props();
	const notice = $derived(liveNotice(reading));
	const overview = $derived(notice ? null : (reading?.snapshot?.liveOverview ?? null));
</script>

<hx-section class="hh-live-overview" aria-labelledby="hh-live-title">
	<hx-div class="hh-live-top">
		<hx-h2 class="hh-needs-title" id="hh-live-title">Live overview</hx-h2>
		{#if overview}
			<hx-p class="hh-live-summary" role="status">{liveSummary(overview)}</hx-p>
			<hx-p class="hh-live-source"
				>From {reading!.answered} of {count(reading!.linked, 'linked computer')} over an encrypted connection
				· read {runTime(overview.readAt)}</hx-p
			>
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
			<HubHomeLiveProject {project} {now} />
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
