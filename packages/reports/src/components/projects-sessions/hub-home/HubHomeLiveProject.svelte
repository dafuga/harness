<!-- @harness-tier organism -->
<!-- @harness-atoms ../../shared-primitives/atoms -->
<!-- @harness-uid u_52e2mcsala -->
<script lang="ts">
	import { tick } from 'svelte';
	import Modal from '../../Modal.svelte';
	import { linkSegments } from '$reports/utils/strings/linkSegments';
	import { pastDueLabel } from './hubHomeStatusText';
	import type { HomePastDue } from '$reports/lib/projects-sessions/hub-home/hubHome.types';
	import LinkifiedText from '$reports/components/shared-primitives/LinkifiedText.svelte';
	import Pill from '$reports/components/explorer-ui/explorer-kit/Pill.svelte';
	import type {
		HomeWorkProject,
		HomeWorkRow,
		HomeWorkState
	} from '$reports/lib/projects-sessions/hub-home/homeLive.types';
	import {
		projectWorkCounts,
		stageLabel,
		statusWords,
		updatedWorkAge,
		workAge,
		workFacts,
		workNow,
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
	const projectId = $props.id();
	let selected = $state.raw<HomeWorkRow>();
	let trigger: HTMLButtonElement | undefined;
	const detail = $derived(
		selected && (project.rows.find(({ key }) => key === selected?.key) ?? selected)
	);

	function openDetails(row: HomeWorkRow, button: HTMLButtonElement) {
		trigger = button;
		selected = row;
	}

	function closeDetails() {
		const button = trigger;
		selected = undefined;
		trigger = undefined;
		void tick().then(() => button?.focus());
	}

	function cardState(row: HomeWorkRow) {
		if (row.launchHold) return workStateLabel(row);
		const due = dueById?.get(row.itemId);
		if (due && row.state === 'queued' && !row.runId) return pastDueLabel(due);
		if (row.state === 'finished' && (row.outcome === 'done' || row.status === 'done'))
			return 'Done';
		return workStateLabel(row);
	}
	const tones: Record<HomeWorkState, string> = {
		running: 'active',
		offline: 'blocked',
		queued: 'needs-you',
		blocked: 'blocked',
		finished: 'quiet'
	};
	const counts = $derived(projectWorkCounts(project));
	const running = $derived(project.rows.filter((row) => row.state === 'running'));
	const blocked = $derived(
		project.rows.filter((row) => row.state === 'blocked' && !row.launchHold)
	);
	const waiting = $derived(
		project.rows.filter(
			(row) => row.launchHold || row.state === 'queued' || row.state === 'offline'
		)
	);
	const finished = $derived(project.rows.filter((row) => row.state === 'finished'));
</script>

{#snippet list(rows: HomeWorkProject['rows'], label: string)}
	<hx-ul class="hh-live-grid" aria-label={label}>
		{#each rows as row (row.key)}
			{@const [, computer, model] = workFacts(row)}
			{@const title = linkSegments(row.title)
				.map(({ href, text }) => (href ? new URL(href).hostname : text))
				.join('')}
			{@const id = `${projectId}-${encodeURIComponent(row.key)}`}
			<hx-li class="hh-live-card" data-state={row.state}>
				<hx-button
					type="button"
					class="hh-live-card-trigger"
					aria-haspopup="dialog"
					aria-labelledby={`${id}-title`}
					aria-describedby={`${id}-state ${id}-facts`}
					onclick={(event) => openDetails(row, event.currentTarget)}
				>
					<hx-span class="hh-live-title" id={`${id}-title`} {title}>{title}</hx-span>
					<hx-span id={`${id}-state`} class="hh-live-card-state">
						<Pill tone={`hh-tone po-state po-${tones[row.state]}`} state={tones[row.state]}>
							<hx-span class="po-mark" aria-hidden="true"></hx-span>{cardState(row)}
						</Pill>
					</hx-span>
					<hx-span class="hh-live-card-facts" id={`${id}-facts`}>
						<hx-span>{model}</hx-span>
						<hx-span>{computer}</hx-span>
						<hx-span>{updatedWorkAge(row.updatedAt, now)}</hx-span>
					</hx-span>
				</hx-button>
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

{#if detail}
	{@const detailText = workNow(detail)}
	<Modal isOpen title="Job details" variant="section" onClose={closeDetails}>
		<hx-div class="hh-live-detail">
			<hx-h3><LinkifiedText text={detail.title} /></hx-h3>
			<hx-p class="hh-live-detail-facts">
				{workStateLabel(detail)} · {statusWords[detail.status]}
				{#if stageLabel(detail.stage)}
					· {stageLabel(detail.stage)}{/if}
			</hx-p>
			<hx-p class="hh-live-detail-facts">{workFacts(detail).join(' · ')}</hx-p>
			<hx-p class="hh-live-detail-facts">{workAge(detail, now)} · {workTimes(detail)}</hx-p>
			{#if detailText}<hx-p><LinkifiedText text={detailText} /></hx-p>{/if}
		</hx-div>
	</Modal>
{/if}
