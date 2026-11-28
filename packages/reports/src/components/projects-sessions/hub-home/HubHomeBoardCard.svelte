<!-- @harness-tier organism -->
<!-- @harness-atoms ../../shared-primitives/atoms -->
<!-- @harness-uid u_ycw5bcmp23 -->
<script lang="ts">
	import Pill from '$reports/components/explorer-ui/explorer-kit/Pill.svelte';
	import { waitAge } from '$reports/lib/projects-sessions/hub-home/waitAge';
	import { boardCardTime, boardComputerName, boardModel } from './hubHomeBoardText';
	import type { BoardViewCard } from './hubHomeBoardView.types';

	let {
		card,
		now,
		show
	}: { card: BoardViewCard; now: number; show: (key: string, trigger: HTMLElement) => void } =
		$props();
	const model = $derived(boardModel(card.row.model));
	const planned = $derived(
		[model, boardComputerName(card.row.computer)].filter((value): value is string => Boolean(value))
	);
	const reason = $derived(
		card.row.state === 'offline'
			? `${card.row.computer ?? 'Its computer'} is offline`
			: (card.row.now?.replace(/^Blocked: /, '') ?? 'No reason recorded')
	);
</script>

<hx-li class="hb-card" data-needs={card.ask ? true : undefined} data-column={card.column}>
	<hx-div class="hb-card-top">
		<hx-span class="hb-project">{card.project}</hx-span>
		{#if card.ask}<hx-span class="hb-age">· waiting {waitAge(card.ask.since, now)}</hx-span>{/if}
		<hx-span class="hb-time">{boardCardTime(card, now)}</hx-span>
		{#if card.ask}<Pill tone="hh-tone po-state po-needs-you" state="needs-you"
				><hx-span class="po-mark" aria-hidden="true"></hx-span>Needs you</Pill
			>{:else if card.priority === 'urgent' && card.column !== 'done'}<hx-span class="hb-urgent"
				>Urgent</hx-span
			>{/if}
	</hx-div>
	<hx-button
		type="button"
		class="hb-open"
		aria-haspopup="dialog"
		onclick={(event) => show(card.row.key, event.currentTarget)}>{card.row.title}</hx-button
	>
	{#if card.ask}
		<hx-div class="hb-ask">
			<hx-span class="hb-line">{card.ask.question}</hx-span>
			<hx-button
				id={`hh-ask-${card.row.itemId}`}
				type="button"
				class="po-action hb-answer hh-needs-talk"
				aria-haspopup="dialog"
				aria-label={`Answer ${card.row.title}`}
				onclick={(event) => show(card.row.key, event.currentTarget)}>Answer</hx-button
			>
		</hx-div>
	{:else if card.column === 'blocked'}
		<hx-p class="hb-reason"
			><hx-span class="hb-mark" aria-hidden="true"></hx-span><hx-span class="hb-line"
				>{reason}</hx-span
			></hx-p
		>
	{:else if card.column === 'done'}
		{#if card.pr}<hx-p class="hb-merged"
				>{card.pr.merged ? '✓ Merged' : 'Pull request'}
				<hx-a class="hb-pr" href={card.pr.url} target="_blank" rel="noreferrer noopener external"
					>PR #{card.pr.number}</hx-a
				></hx-p
			>{:else}<hx-p class="hb-note">✓ Done</hx-p>{/if}
	{:else if planned.length}
		<hx-ul class="hb-tags" aria-label="Model and computer">
			{#each planned as value (value)}<hx-li class="hb-tag">{value}</hx-li>{/each}
		</hx-ul>
	{:else}<hx-p class="hb-note">Not scheduled</hx-p>{/if}
</hx-li>
