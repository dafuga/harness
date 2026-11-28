<!-- @harness-tier organism -->
<!-- @harness-atoms ../../shared-primitives/atoms -->
<!-- @harness-uid u_ycw5bdtl23 -->
<script lang="ts">
	import Modal from '$reports/components/Modal.svelte';
	import Pill from '$reports/components/explorer-ui/explorer-kit/Pill.svelte';
	import LinkifiedText from '$reports/components/shared-primitives/LinkifiedText.svelte';
	import { waitAge } from '$reports/lib/projects-sessions/hub-home/waitAge';
	import type { HomeChatReceipt } from '$reports/lib/projects-sessions/hub-home/hubHome.types';
	import HubHomeAsk from './HubHomeAsk.svelte';
	import { homeCosChat } from './hubHomeChatContext.svelte';
	import { boardColumns } from './hubHomeBoardView';
	import { boardComputerName, boardModel, boardTime } from './hubHomeBoardText';
	import type { BoardViewCard } from './hubHomeBoardView.types';
	import type { SendHomeChat } from './hubHomeView.types';

	let {
		card,
		now,
		send,
		receipt,
		close
	}: {
		card: BoardViewCard;
		now: number;
		send: SendHomeChat;
		receipt: (id: string) => Promise<HomeChatReceipt>;
		close: () => void;
	} = $props();
	const chat = homeCosChat();
	const state = $derived(boardColumns.find((column) => column.id === card.column)?.label ?? '');
	const facts = $derived(
		[
			['Agent', card.row.owner],
			['Computer', boardComputerName(card.row.computer)],
			['Model', boardModel(card.row.model)],
			['Started', card.row.startedAt && boardTime(card.row.startedAt, now)],
			[card.column === 'progress' ? 'ETA' : 'Due', card.due && boardTime(card.due, now)],
			['Task', card.row.itemId]
		].filter((fact): fact is [string, string] => Boolean(fact[1]))
	);
</script>

<Modal isOpen title={card.row.title} summary={card.project} variant="section" onClose={close}>
	<hx-div class="hb-detail" data-harness-component="board-detail">
		<hx-div class="hb-detail-state">
			{#if card.ask}<Pill tone="hh-tone po-state po-needs-you" state="needs-you"
					><hx-span class="po-mark" aria-hidden="true"></hx-span>Needs you</Pill
				>
				<hx-span class="hb-sub">waiting {waitAge(card.ask.since, now)}</hx-span>
			{:else}<hx-span class="hb-tag">{state}</hx-span>{/if}
		</hx-div>
		<hx-ul class="hb-facts">
			{#each facts as [label, value] (label)}
				<hx-li><hx-span class="hb-label">{label}</hx-span><hx-span>{value}</hx-span></hx-li>
			{/each}
		</hx-ul>
		{#if card.ask}
			<HubHomeAsk ask={card.ask} {send} {receipt} />
		{:else if card.row.now}<hx-p class="hb-why"><LinkifiedText text={card.row.now} /></hx-p>{/if}
		<hx-div class="hb-detail-actions">
			<hx-button
				type="button"
				class="po-action"
				aria-haspopup="dialog"
				onclick={(event) => {
					const trigger = event.currentTarget;
					if (card.ask) chat?.openAsk(trigger, card.row.itemId);
					else chat?.open(trigger, { id: card.row.itemId, title: card.row.title });
				}}>Open chat</hx-button
			>
			{#if card.pr}<hx-a
					class="po-action"
					href={card.pr.url}
					target="_blank"
					rel="noreferrer noopener external">View PR #{card.pr.number}</hx-a
				>{/if}
		</hx-div>
		{#if card.notes?.length}
			<hx-h3 class="hb-label">Latest notes</hx-h3>
			<hx-ul class="hb-notes">
				{#each card.notes as note, index (`${note.at}:${index}`)}
					<hx-li
						><hx-span class="hb-sub">{boardTime(note.at, now)}</hx-span><hx-span
							><LinkifiedText text={note.text} /></hx-span
						></hx-li
					>
				{/each}
			</hx-ul>
		{/if}
	</hx-div>
</Modal>
