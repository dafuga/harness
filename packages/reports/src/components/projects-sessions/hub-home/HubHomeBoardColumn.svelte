<!-- @harness-tier organism -->
<!-- @harness-atoms ../../shared-primitives/atoms -->
<!-- @harness-uid u_ycwbrdcolm -->
<script lang="ts">
	import Pill from '$reports/components/explorer-ui/explorer-kit/Pill.svelte';
	import type { HomeBoardCard } from '$reports/lib/projects-sessions/hub-home/homeTaskBoard.types';
	import { linkSegments } from '$reports/utils/strings/linkSegments';
	import { count } from './hubHomePresentation';
	import { updatedWorkAge } from './hubHomeLive';
	import { boardCardWho, priorityLabels, shortItemId } from './hubHomeTaskBoard';
	import type { HomeBoardColumnView } from './hubHomeTaskBoard';

	let {
		column,
		now,
		open
	}: {
		column: HomeBoardColumnView;
		now: number;
		open: (card: HomeBoardCard, button: HTMLButtonElement) => void;
	} = $props();
	const id = $props.id();
	const hidden = $derived(column.total - column.cards.length);

	/** A link in a title reads as its host name; the detail view holds the full clickable link. */
	function plain(title: string) {
		return linkSegments(title)
			.map(({ href, text }) => (href ? new URL(href).hostname : text))
			.join('');
	}
</script>

<hx-section class="hh-board-column" data-column={column.id} aria-labelledby={id}>
	<hx-h3 class="hh-board-head" {id}>
		<hx-span>{column.title}</hx-span>
		<hx-span class="hh-board-count">{column.total.toLocaleString('en-US')}</hx-span>
		{#if column.note}<hx-span class="hh-board-note">{column.note}</hx-span>{/if}
	</hx-h3>
	<hx-ul class="hh-board-cards">
		{#each column.cards as card (card.row.itemId)}
			<hx-li class="hh-board-card" data-needs-you={card.needsYou || undefined}>
				<hx-button
					type="button"
					class="hh-board-card-trigger"
					aria-haspopup="dialog"
					onclick={(event) => open(card, event.currentTarget)}
				>
					<hx-span class="hh-board-line">
						<hx-span class="hh-board-id">{shortItemId(card.row.itemId)}</hx-span>
						<hx-span class="hh-board-priority" data-priority={card.priority}
							>{priorityLabels[card.priority]}</hx-span
						>
					</hx-span>
					<hx-span class="hh-board-title" title={plain(card.row.title)}
						>{plain(card.row.title)}</hx-span
					>
					{#if card.needsYou}
						<Pill tone="hh-tone po-state po-needs-you" state="needs-you"
							><hx-span class="po-mark" aria-hidden="true"></hx-span>Needs you</Pill
						>
					{/if}
					{#if card.reason}<hx-span class="hh-board-reason" title={card.reason}
							>{card.reason}</hx-span
						>{/if}
					<hx-span class="hh-board-facts">{card.project} · {boardCardWho(card)}</hx-span>
					<hx-span class="hh-board-facts">
						{#if column.id === 'todo' || column.id === 'progress'}{card.label} ·
						{/if}{updatedWorkAge(card.row.updatedAt, now)}
					</hx-span>
				</hx-button>
			</hx-li>
		{/each}
	</hx-ul>
	{#if !column.total}<hx-p class="po-sessions hh-board-empty">{column.empty}</hx-p>
	{:else if hidden > 0}<hx-p class="po-sessions hh-board-empty"
			>{count(hidden, 'more item')} counted, not listed. Pick a project or open Tracker.</hx-p
		>{/if}
</hx-section>
