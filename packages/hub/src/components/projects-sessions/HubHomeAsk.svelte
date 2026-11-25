<!-- @harness-tier organism -->
<!-- @harness-atoms ../../../../reports/src/components/shared-primitives/atoms -->
<!-- @harness-uid u_5hn7c2wq8d -->
<!-- @harness-uid u_gnhmm7tirz -->
<script lang="ts">
	import type {
		HomeAgent,
		HomeChatInput,
		HomeChatReceipt
	} from '$reports/lib/projects-sessions/hub-home/hubHome.types';
	import type { SendHomeChat } from './hubHomeView.types';
	import HubHomeChoices from './HubHomeChoices.svelte';

	let {
		agent,
		send,
		receipt
	}: {
		agent: HomeAgent;
		send: SendHomeChat;
		receipt: (id: string) => Promise<HomeChatReceipt>;
	} = $props();
	let reply = $state('');
	let busy = $state(false);
	let status = $state('');
	/** The question this card already answered, so it hides until the Tracker shows a new one. */
	let answered = $state<string | null>(null);
	const open = $derived(Boolean(agent.itemId && agent.question) && answered !== agent.question);

	async function answerWith(text: string, tap?: { number: number; confirmed: boolean }) {
		if (!agent.itemId || !agent.question || !text.trim() || busy) return;
		const message: HomeChatInput = {
			id: crypto.randomUUID(),
			agentId: agent.id,
			itemId: agent.itemId,
			kind: 'answer',
			question: agent.question,
			text: text.trim(),
			...(tap && { option: tap.number, ...(tap.confirmed && { confirmed: true as const }) })
		};
		busy = true;
		status = '';
		try {
			const result = await send(message);
			if (result.status === 'queued' || result.status === 'sent') {
				answered = agent.question;
				reply = '';
				void settle(message.id, result);
			} else status = 'The Tracker no longer has that question open.';
		} catch {
			status = 'Could not queue the answer. Check Tracker before retrying.';
		} finally {
			busy = false;
		}
	}

	async function settle(id: string, first: HomeChatReceipt) {
		status = `Answer ${first.status}`;
		for (let attempt = 0; attempt < 15 && first.status === 'queued'; attempt++) {
			await new Promise((done) => setTimeout(done, 2000));
			first = await receipt(id).catch(() => first);
			status = `Answer ${first.status}`;
		}
	}

	function onkeydown(event: KeyboardEvent) {
		if (event.key !== 'Enter') return;
		event.preventDefault();
		void answerWith(reply);
	}
</script>

{#if open}
	<hx-section class="hh-ask" aria-label={`${agent.name} needs you`}>
		<hx-p class="hh-ask-question"><hx-strong>{agent.name}</hx-strong> · {agent.question}</hx-p>
		<HubHomeChoices
			{agent}
			{busy}
			onpick={(number, confirmed) => {
				const option = agent.options?.[number - 1];
				if (option) void answerWith(option.label, { number, confirmed });
			}}
		/>
		<hx-div class="hh-quick">
			<hx-input
				aria-label={`Reply to ${agent.name}`}
				placeholder="Reply…"
				maxlength={2000}
				bind:value={reply}
				{onkeydown}
			/>
			<hx-button
				type="button"
				class="po-action hh-primary"
				disabled={busy || !reply.trim()}
				onclick={() => answerWith(reply)}>Send</hx-button
			>
		</hx-div>
	</hx-section>
{:else if status}
	<hx-p class="po-sessions" role="status">{agent.name}: {status}</hx-p>
{/if}
{#if open && status}<hx-p role="status">{status}</hx-p>{/if}
