<!-- @harness-tier organism -->
<!-- @harness-atoms ../../shared-primitives/atoms -->
<!-- @harness-uid u_52e2mcsala -->
<script lang="ts">
	import { pastDueLabel } from './hubHomeStatusText';
	import type { HomePastDue } from '$reports/lib/projects-sessions/hub-home/hubHome.types';
	import { hasWebLink } from '$reports/utils/strings/linkSegments';
	import LinkifiedText from '$reports/components/shared-primitives/LinkifiedText.svelte';
	import Pill from '$reports/components/explorer-ui/explorer-kit/Pill.svelte';
	import type {
		HomeWorkProject,
		HomeWorkState
	} from '$reports/lib/projects-sessions/hub-home/homeLive.types';
	import {
		projectWorkCounts,
		stageLabel,
		statusWords,
		workAge,
		workFacts,
		workStateLabel,
		workTimes
	} from './hubHomeLive';

	let {
		project,
		now,
		dueById
	}: { project: HomeWorkProject; now: number; dueById?: ReadonlyMap<string, HomePastDue> } =
		$props();
	let all = $state(false);
	const tones: Record<HomeWorkState, string> = {
		running: 'active',
		offline: 'blocked',
		queued: 'needs-you',
		blocked: 'blocked',
		finished: 'quiet'
	};
	const counts = $derived(projectWorkCounts(project));
	const running = $derived(project.rows.filter((row) => row.state === 'running'));
	const blocked = $derived(project.rows.filter((row) => row.state === 'blocked'));
	const waiting = $derived(
		project.rows.filter((row) => row.state === 'queued' || row.state === 'offline')
	);
	const finished = $derived(project.rows.filter((row) => row.state === 'finished'));
</script>

{#snippet list(rows: HomeWorkProject['rows'], label: string)}
	<hx-ul class="hh-live-rows" aria-label={label}>
		{#each rows as row (row.key)}
			{@const linked = hasWebLink(row.title)}
			{@const due = dueById?.get(row.itemId)}
			{@const label =
				due && row.state === 'queued' && !row.runId
					? pastDueLabel(due)
					: workStateLabel(row)}
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
						><hx-span class="po-mark" aria-hidden="true"></hx-span>{label}</Pill
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
{/snippet}

<hx-details
	class="hh-live-project"
	ontoggle={(event) => {
		if (!event.currentTarget.open) all = false;
	}}
>
	<hx-summary class="hh-live-head">
		<hx-span class="hh-live-name">{project.agent}</hx-span>
		<hx-span class="hh-live-counts"
			>Running {counts.running} · Blocked {counts.blocked} · Not running {counts.resting}</hx-span
		>
	</hx-summary>
	{#if running.length}{@render list(running, `${project.agent} running jobs`)}
	{:else}<hx-p class="po-sessions hh-live-more">No running jobs</hx-p>{/if}
	{#if blocked.length}<hx-h3 class="po-band-title">Blocked</hx-h3>{@render list(
			blocked,
			'Blocked jobs'
		)}{/if}
	{#if waiting.length}<hx-h3 class="po-band-title">Waiting</hx-h3>{@render list(
			waiting,
			'Waiting jobs'
		)}{/if}
	{#if finished.length || counts.blocked + counts.resting > blocked.length + waiting.length}
		<hx-button
			type="button"
			class="po-action hh-live-more"
			aria-expanded={all}
			onclick={() => (all = !all)}
		>
			{all ? 'Show fewer' : 'See all'} · Blocked {counts.blocked} · Not running {counts.resting}
		</hx-button>
		{#if all}
			{#if finished.length}<hx-h3 class="po-band-title">Not running</hx-h3>{@render list(
					finished,
					'Not running jobs'
				)}{/if}
			{#if counts.blocked + counts.resting > blocked.length + waiting.length}
				<hx-p class="po-sessions"
					>Additional jobs were counted but their details were not reported by this computer.</hx-p
				>
			{/if}
		{/if}
	{/if}
</hx-details>
