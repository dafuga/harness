<!-- @harness-tier organism -->
<!-- @harness-atoms ../../../../reports/src/components/shared-primitives/atoms -->
<!-- @harness-uid u_suxmf5vsuw -->
<script lang="ts">
	import { tick } from 'svelte';
	import Modal from '$reports/components/Modal.svelte';
	import Pill from '$reports/components/explorer-ui/explorer-kit/Pill.svelte';
	import type {
		HomeAgent,
		HomeChatInput,
		HomeChatReceipt,
		HomeMessage
	} from '$reports/lib/projects-sessions/hub-home/hubHome.types';
	import { agentLabels, messageStatusText, overviewTone, runTime } from './hubHomePresentation';
	import type { SendHomeChat } from './hubHomeView.types';
	import HubHomeComposer from './HubHomeComposer.svelte';

	let {
		agent,
		now,
		send,
		trigger = $bindable<HTMLElement | null>(null)
	}: {
		agent?: HomeAgent;
		now: string;
		send: SendHomeChat;
		trigger?: HTMLElement | null;
	} = $props();
	const name = 'Chief of Staff';
	let draft = $state('');
	let pending = $state(false);
	let feedback = $state('');

	function close() {
		const opener = trigger;
		trigger = null;
		void tick().then(() => opener?.focus());
	}
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
		onclick={(event) => (trigger = event.currentTarget)}>Open chat</hx-button
	>
</hx-section>

<Modal isOpen={Boolean(trigger)} title={name} variant="section" onClose={close}>
	<hx-div class="hh-cos-widget">
		{#if shown.length}
			<hx-div class="hh-cos-history">
				<hx-ol class="hh-thread hh-cos-thread" aria-label="Chief of Staff conversation">
					{#each shown as entry (entry.id)}
						{@const status = messageStatusText(entry, name)}
						<hx-li class="hh-msg" data-from={entry.from} data-status={entry.status}>
							<hx-p>{entry.text}</hx-p>
							<hx-span class="hh-msg-at"
								>{status ? `${status} · ${runTime(entry.at)}` : runTime(entry.at)}</hx-span
							>
						</hx-li>
					{/each}
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
			label="Message {name}"
		/>
	</hx-div>
</Modal>
