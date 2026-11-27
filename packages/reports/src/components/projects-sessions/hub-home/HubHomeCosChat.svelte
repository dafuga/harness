<!-- @harness-tier organism -->
<!-- @harness-atoms ../../shared-primitives/atoms -->
<!-- @harness-uid u_suxmf5vsuw -->
<script lang="ts">
	import LinkifiedText from '$reports/components/shared-primitives/LinkifiedText.svelte';
	import { askKey, homeCosChat, provideHomeCosChat } from './hubHomeChatContext.svelte';
	import Modal from '$reports/components/Modal.svelte';
	import Pill from '$reports/components/explorer-ui/explorer-kit/Pill.svelte';
	import type {
		HomeAgent,
		HomeChatInput,
		HomeChatReceipt,
		HomeMessage,
		HomeOpenAsk,
		SendHomeChat
	} from '$reports/lib/projects-sessions/hub-home/hubHome.types';
	import { agentLabels, messageStatusText, overviewTone, runTime } from './hubHomePresentation';
	import { MediaQuery } from 'svelte/reactivity';
	import HubHomeAsk from './HubHomeAsk.svelte';
	import HubHomeComposer from './HubHomeComposer.svelte';

	let {
		agent,
		now,
		send,
		receipt,
		asks = [],
		showCard = true
	}: {
		agent?: HomeAgent;
		now: string;
		send: SendHomeChat;
		receipt?: (id: string) => Promise<HomeChatReceipt>;
		asks?: HomeOpenAsk[];
		showCard?: boolean;
	} = $props();
	const chat = homeCosChat() ?? provideHomeCosChat();
	const name = 'Chief of Staff';
	const phone = new MediaQuery('max-width: 560px');
	const askId = $derived(chat.target?.askId);
	const ask = $derived.by(() => {
		const current = asks.find((entry) => entry.itemId === askId);
		if (current) return chat.answers.get(askKey(current))?.dismissed ? undefined : current;
		return [...chat.answers.values()].find((held) => held.ask.itemId === askId && !held.dismissed)
			?.ask;
	});
	const item = $derived(
		ask ? { id: ask.itemId, title: ask.title, details: ask.question } : chat.target?.item
	);
	const draftKey = $derived(askId ?? item?.id);
	let draft = $state('');
	let pending = $state(false);
	let feedback = $state('');
	let draftItem = $state<string>();

	$effect(() => {
		if (!chat.target || draftItem === draftKey) return;
		draftItem = draftKey;
		draft = '';
		feedback = '';
	});
	/** Chief of Staff is always reachable, even before the Tracker reports anything for it. */
	const chief = $derived<HomeAgent>(
		agent ?? {
			id: 'cos',
			name,
			state: 'idle',
			sessions: 0,
			tasks: [],
			subAgents: { sessions: 0, tasks: [] },
			itemId: null,
			task: 'No current Tracker item',
			machine: null,
			model: null,
			since: now,
			question: null,
			messages: []
		}
	);
	let sent = $state<HomeMessage[]>([]);
	const thread = $derived(chief.messages.filter((entry) => entry.messageId || entry.replyTo));
	/** Sent here and not yet read back from the Tracker. */
	const waiting = $derived(
		sent.filter((entry) => !thread.some((known) => known.messageId === entry.messageId))
	);
	/** The latest few only, so the newest is always on screen; the Agents dialog keeps the rest. */
	const shown = $derived([...thread, ...waiting].slice(-4));

	function submitted(message: HomeChatInput, receipt: HomeChatReceipt) {
		if (receipt.status !== 'sent' || !receipt.messageId) return;
		const entry: HomeMessage = {
			id: `sent-${message.id}`,
			messageId: receipt.messageId,
			text: message.text,
			at: new Date().toISOString(),
			from: 'you',
			status: 'stored'
		};
		sent = [...sent, entry];
	}
</script>

{#if showCard}
	<hx-section class="po-card hh-cos-card" aria-label={name}>
		<hx-div class="hh-cos-heading">
			<hx-h2 class="hh-needs-title">{name}</hx-h2>
			{#if agent}
				{@const tone = overviewTone(agent.state)}
				<Pill tone={`hh-tone po-state po-${tone}`} state={tone}>{agentLabels[agent.state]}</Pill>
			{:else}
				<hx-p class="po-sessions">Status unavailable</hx-p>
			{/if}
		</hx-div>
		<hx-button
			type="button"
			class="po-action"
			aria-haspopup="dialog"
			onclick={(event) => chat.open(event.currentTarget)}>Open chat</hx-button
		>
	</hx-section>
{/if}

<Modal
	isOpen={Boolean(chat.target)}
	title={name}
	variant="section"
	modal={!askId || phone.current}
	onClose={chat.close}
>
	<hx-div class="hh-cos-widget">
		{#if item && !askId}<hx-p class="po-sessions hh-cos-context" aria-label="Attached item">
				About <LinkifiedText text={item.title} />
			</hx-p>{/if}
		{#if shown.length || ask || askId}
			<hx-div class="hh-cos-history">
				<hx-ol class="hh-thread hh-cos-thread" aria-label="Chief of Staff conversation">
					{#each shown as entry (entry.id)}
						{@const status = messageStatusText(entry, name)}
						<hx-li class="hh-msg" data-from={entry.from} data-status={entry.status}>
							<hx-p><LinkifiedText text={entry.text} /></hx-p>
							<hx-span class="hh-msg-at"
								>{status ? `${status} · ${runTime(entry.at)}` : runTime(entry.at)}</hx-span
							>
						</hx-li>
					{/each}
					{#if ask && receipt}
						<hx-li class="hh-msg hh-msg-ask" data-from="agent">
							{#key `${ask.itemId}:${ask.question}`}<HubHomeAsk {ask} {send} {receipt} />{/key}
						</hx-li>
					{:else if askId}
						<hx-li class="po-sessions" role="status">This question is no longer open.</hx-li>
					{/if}
				</hx-ol>
			</hx-div>
		{:else}
			<hx-p class="po-sessions hh-cos-empty">No messages yet.</hx-p>
		{/if}
		<HubHomeComposer
			agents={[chief]}
			agentId="cos"
			{send}
			{submitted}
			bind:draft
			bind:pending
			bind:feedback
			itemContext={item}
			label="Message {name}"
		/>
	</hx-div>
</Modal>
