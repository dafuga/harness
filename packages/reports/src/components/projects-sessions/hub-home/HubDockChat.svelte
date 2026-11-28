<!-- @harness-tier organism -->
<!-- @harness-atoms ../../shared-primitives/atoms -->
<!-- @harness-uid u_dk6r1tjm8g -->
<!-- @harness-uid u_jdn74uxwmi -->
<script lang="ts">
	import LinkifiedText from '$reports/components/shared-primitives/LinkifiedText.svelte';
	import type {
		HomeAgent,
		HomeChatInput,
		HomeChatReceipt,
		HomeMessage,
		HomeOpenAsk,
		SendHomeChat
	} from '$reports/lib/projects-sessions/hub-home/hubHome.types';
	import { dockWait } from './hubDockModel';
	import { askKey, homeCosChat } from './hubHomeChatContext.svelte';
	import { messageStatusText, runTime } from './hubHomePresentation';
	import HubHomeAsk from './HubHomeAsk.svelte';
	import HubHomeComposer from './HubHomeComposer.svelte';

	let {
		agent,
		asks,
		now,
		send,
		receipt
	}: {
		agent: HomeAgent;
		asks: HomeOpenAsk[];
		now: number;
		send: SendHomeChat;
		receipt: (id: string) => Promise<HomeChatReceipt>;
	} = $props();
	const answers = homeCosChat()?.answers;

	/** An answered question keeps its card until its confirmation has been shown. */
	const open = $derived.by(() => {
		const listed = asks.filter((ask) => ask.agentId === agent.id);
		const keys = new Set(listed.map(askKey));
		const held = [...(answers?.values() ?? [])]
			.filter((entry) => entry.ask.agentId === agent.id && !entry.dismissed)
			.map((entry) => entry.ask)
			.filter((ask) => !keys.has(askKey(ask)));
		return [...listed, ...held].filter((ask) => !answers?.get(askKey(ask))?.dismissed);
	});
	const confirmations = $derived(
		[...(answers?.values() ?? [])].filter(
			(entry) => entry.ask.agentId === agent.id && entry.dismissed
		)
	);
	let sent = $state<HomeMessage[]>([]);
	const thread = $derived(agent.messages.filter((entry) => entry.id !== 'question'));
	/** Sent here and not yet read back from the Tracker. */
	const waiting = $derived(
		sent.filter(
			(entry) =>
				!thread.some((known) =>
					entry.messageId
						? known.messageId === entry.messageId
						: known.from === 'you' && known.text === entry.text
				)
		)
	);
	const shown = $derived([...thread, ...waiting].slice(-6));

	function submitted(message: HomeChatInput, result: HomeChatReceipt) {
		if (result.status !== 'sent' && result.status !== 'queued') return;
		const entry: HomeMessage = {
			id: `sent-${message.id}`,
			messageId: result.messageId,
			text: message.text,
			at: new Date().toISOString(),
			from: 'you',
			...(result.messageId && { status: 'stored' as const })
		};
		sent = [...sent, entry];
	}

	/** Opens a chat at its newest message, or at the top of a question. */
	function settle(node: HTMLElement) {
		const question = node.querySelector<HTMLElement>('.hd-ask');
		node.scrollTop = question ? question.offsetTop - node.offsetTop : node.scrollHeight;
	}
</script>

<hx-div class="hd-chat" {@attach settle}>
	{#if shown.length}
		<hx-ol class="hh-thread" aria-label={`${agent.name} conversation`}>
			{#each shown as entry (entry.id)}
				{@const status = messageStatusText(entry, agent.name)}
				<hx-li class="hh-msg" data-from={entry.from} data-status={entry.status}>
					<hx-p><LinkifiedText text={entry.text} /></hx-p>
					<hx-span class="hh-msg-at"
						>{status ? `${status} · ${runTime(entry.at)}` : runTime(entry.at)}</hx-span
					>
				</hx-li>
			{/each}
		</hx-ol>
	{:else if !open.length}
		<hx-p class="hd-meta">No messages yet.</hx-p>
	{/if}
	{#each open as ask (askKey(ask))}
		<hx-div class="hd-ask">
			<HubHomeAsk
				{ask}
				{send}
				{receipt}
				kicker={`Question · waiting ${dockWait(ask.since, now)}`}
			/>
		</hx-div>
	{/each}
	{#each confirmations as entry (askKey(entry.ask))}
		<hx-p class="po-sessions hh-answer-feedback">{entry.status}</hx-p>
	{/each}
</hx-div>
<hx-div class="hd-compose">
	{#if agent.id === 'cos' || agent.itemId}
		<HubHomeComposer
			agents={[agent]}
			agentId={agent.id}
			{send}
			{submitted}
			label={`Message ${agent.name}`}
			sendText="Send"
		/>
	{:else}
		<hx-p class="hd-meta">This agent has no current Tracker item.</hx-p>
	{/if}
</hx-div>
