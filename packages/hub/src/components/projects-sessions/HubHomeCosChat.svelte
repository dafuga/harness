<!-- @harness-tier organism -->
<!-- @harness-atoms ../../../../reports/src/components/shared-primitives/atoms -->
<!-- @harness-uid u_suxmf5vsuw -->
<script lang="ts">
	import type {
		HomeAgent,
		HomeChatInput,
		HomeChatReceipt,
		HomeMessage
	} from '$reports/lib/projects-sessions/hub-home/hubHome.types';
	import { messageStatusText, runTime } from './hubHomePresentation';
	import type { SendHomeChat } from './hubHomeView.types';
	import HubHomeComposer from './HubHomeComposer.svelte';

	let { agent, now, send }: { agent?: HomeAgent; now: string; send: SendHomeChat } = $props();
	const name = 'Chief of Staff';
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

<hx-section class="po-card hh-cos-chat" aria-label="Message Chief of Staff">
	<hx-h2 class="hh-needs-title">Message {name}</hx-h2>
	{#if shown.length}
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
	{/if}
	<HubHomeComposer agents={[chief]} agentId="cos" {send} {submitted} label="Message {name}" />
</hx-section>
