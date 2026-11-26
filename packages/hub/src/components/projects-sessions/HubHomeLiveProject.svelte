<!-- @harness-tier organism -->
<!-- @harness-atoms ../../../../reports/src/components/shared-primitives/atoms -->
<!-- @harness-uid u_52e2mcsala -->
<script lang="ts">
	import Pill from '$reports/components/explorer-ui/explorer-kit/Pill.svelte';
	import type {
		HomeWorkProject,
		HomeWorkState
	} from '$reports/lib/projects-sessions/hub-home/homeLive.types';
	import {
		projectSummary,
		stageLabel,
		statusWords,
		workAge,
		workFacts,
		workStateLabel
	} from './hubHomeLive';

	let { project, now }: { project: HomeWorkProject; now: number } = $props();
	let all = $state(false);
	const tones: Record<HomeWorkState, string> = {
		running: 'active',
		offline: 'blocked',
		queued: 'needs-you',
		'no-run': 'quiet',
		finished: 'quiet'
	};
	/** Every live and waiting run shows; resting tasks past the first few are behind a button. */
	const first = $derived(
		Math.max(5, project.rows.filter((row) => !['no-run', 'finished'].includes(row.state)).length)
	);
	const rows = $derived(all ? project.rows : project.rows.slice(0, first));
</script>

<hx-details class="hh-live-project" open={project.running > 0}>
	<hx-summary class="hh-live-head">
		<hx-span class="hh-live-name">{project.agent}</hx-span>
		<hx-span class="hh-live-counts">{projectSummary(project)}</hx-span>
	</hx-summary>
	<hx-ul class="hh-live-rows" aria-label={`${project.agent} sessions and runs`}>
		{#each rows as row (row.key)}
			<hx-li class="hh-live-row" data-state={row.state}>
				<hx-span class="hh-live-title" title={row.title}>{row.title}</hx-span>
				<hx-span class="hh-live-tags">
					<Pill tone={`hh-tone po-state po-${tones[row.state]}`} state={tones[row.state]}
						><hx-span class="po-mark" aria-hidden="true"></hx-span>{workStateLabel(row)}</Pill
					>
					<hx-span class="hh-live-stage">Stage: {stageLabel(row.stage)}</hx-span>
					<hx-span class="hh-live-status">{statusWords[row.status]}</hx-span>
				</hx-span>
				<hx-span class="hh-live-facts">
					{#each workFacts(row) as fact, name (name)}<hx-span>{fact}</hx-span>{/each}
					<hx-span>{workAge(row, now)}</hx-span>
				</hx-span>
			</hx-li>
		{/each}
	</hx-ul>
	{#if project.rows.length > first}
		<hx-button type="button" class="po-action hh-live-more" onclick={() => (all = !all)}
			>{all ? 'Show fewer' : `Show all ${project.rows.length}`}</hx-button
		>
	{/if}
</hx-details>
