<!-- @harness-tier organism -->
<!-- @harness-atoms ../../shared-primitives/atoms -->
<!-- @harness-uid u_52e2mcsala -->
<script lang="ts">
	import { hasWebLink } from '$reports/utils/strings/linkSegments';
	import LinkifiedText from '$reports/components/shared-primitives/LinkifiedText.svelte';
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
		workStateLabel,
		workTimes
	} from './hubHomeLive';

	let { project, now }: { project: HomeWorkProject; now: number } = $props();
	let all = $state(false);
	const tones: Record<HomeWorkState, string> = {
		running: 'active',
		offline: 'blocked',
		queued: 'needs-you',
		blocked: 'blocked',
		finished: 'quiet'
	};
	/** Every live and waiting run shows; resting tasks past the first few are behind a button. */
	const first = $derived(
		Math.max(5, project.rows.filter((row) => row.state !== 'finished').length)
	);
	const rows = $derived(all ? project.rows : project.rows.slice(0, first));
</script>

<hx-details class="hh-live-project">
	<hx-summary class="hh-live-head">
		<hx-span class="hh-live-name">{project.agent}</hx-span>
		<hx-span class="hh-live-counts">{projectSummary(project)}</hx-span>
	</hx-summary>
	<hx-ul class="hh-live-rows" aria-label={`${project.agent} sessions and runs`}>
		{#each rows as row (row.key)}
			{@const linked = hasWebLink(row.title)}
			<hx-li class="hh-live-row" data-state={row.state}>
				<hx-div class="hh-live-item-text">
					{#if linked}<hx-p class="hh-live-linked"><LinkifiedText text={row.title} /></hx-p>{/if}
					<hx-details class="hh-live-item">
						<hx-summary class="hh-live-open">
							{#if linked}Run details{:else}
								<hx-span class="hh-live-title" title={row.title}>{row.title}</hx-span>
							{/if}
						</hx-summary>
						<hx-p class="hh-live-times">{workTimes(row)}</hx-p>
					</hx-details>
				</hx-div>
				<hx-span class="hh-live-tags">
					<Pill tone={`hh-tone po-state po-${tones[row.state]}`} state={tones[row.state]}
						><hx-span class="po-mark" aria-hidden="true"></hx-span>{workStateLabel(row)}</Pill
					>
					{#if stageLabel(row.stage)}<hx-span class="hh-live-stage">{stageLabel(row.stage)}</hx-span
						>{/if}
					{#if row.state !== 'blocked' && row.state !== 'queued'}
						<hx-span class="hh-live-status">{statusWords[row.status]}</hx-span>
					{/if}
				</hx-span>
				{#if row.now}<hx-span class="hh-live-now" title={row.now}
						><LinkifiedText text={row.now} /></hx-span
					>{/if}
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
