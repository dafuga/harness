<!-- @harness-tier organism -->
<!-- @harness-atoms ../../shared-primitives/atoms -->
<!-- @harness-uid u_ufkzhmhxgn -->
<script lang="ts">
	import type { HomePastDue } from '$reports/lib/projects-sessions/hub-home/hubHome.types';
	import {
		pastDueLabel,
		pastDueSummary
	} from './hubHomePresentation';
	import HubHomeRow from './HubHomeRow.svelte';

	let { pastDue, work, limit }: { pastDue: HomePastDue[]; work: { id: string }[]; limit?: number } =
		$props();
	// Running and blocked tasks are already listed as work, labelled with the same state.
	const unlisted = $derived(pastDue.filter((run) => !work.some((item) => item.id === run.id)));
</script>

{#if unlisted.length}
	<hx-section class="hh-group hh-not-started" aria-label="Past due, not started">
		<hx-h3 class="po-band-title">Past due, not started</hx-h3>
		<hx-p class="po-sessions">{pastDueSummary(unlisted)}</hx-p>
		<hx-ul class="po-items">
			{#each unlisted.slice(0, limit) as run (run.id)}
				<HubHomeRow title={run.title} meta={[run.agent, run.reason].filter(Boolean).join(' · ')}>
					{#snippet trailing()}
						<hx-span class="po-eta" data-tone={run.state === 'blocked' ? 'overdue' : 'soon'}
							>{pastDueLabel(run)}</hx-span
						>
					{/snippet}
				</HubHomeRow>
			{/each}
		</hx-ul>
	</hx-section>
{/if}
