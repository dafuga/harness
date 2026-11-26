<!-- @harness-tier organism -->
<!-- @harness-atoms ../../../../reports/src/components/shared-primitives/atoms -->
<!-- @harness-uid u_5hn7c2wq8d -->
<!-- @harness-uid u_gnhmm7tirz -->
<script lang="ts">
	import type {
		HomeChatInput,
		HomeChatReceipt,
		HomeOpenAsk
	} from '$reports/lib/projects-sessions/hub-home/hubHome.types';
	import type { SendHomeChat } from './hubHomeView.types';
	import HubHomeChoices from './HubHomeChoices.svelte';

	let {
		ask,
		send,
		receipt,
		submitted
	}: {
		ask: HomeOpenAsk;
		send: SendHomeChat;
		receipt: (id: string) => Promise<HomeChatReceipt>;
		submitted?: (message: HomeChatInput, receipt: HomeChatReceipt) => void;
	} = $props();
	let busy = $state(false);
	let status = $state('');
	/** The question this card already answered, so it hides until the Tracker shows a new one. */
	let answered = $state<string | null>(null);
	const open = $derived(answered !== ask.question);

	async function answerWith(text: string, tap?: { number: number; confirmed: boolean }) {
		if (!text.trim() || busy) return;
		const message: HomeChatInput = {
			id: crypto.randomUUID(),
			agentId: ask.agentId,
			itemId: ask.itemId,
			kind: 'answer',
			question: ask.question,
			text: text.trim(),
			...(tap && { option: tap.number, ...(tap.confirmed && { confirmed: true as const }) })
		};
		busy = true;
		status = '';
		try {
			const result = await send(message);
			submitted?.(message, result);
			if (result.status === 'queued' || result.status === 'sent') {
				answered = ask.question;
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
</script>

{#if open}
	<hx-section class="hh-ask" aria-label={`${ask.agentName} needs you`}>
		<hx-p class="hh-ask-question"><hx-strong>{ask.agentName}</hx-strong> · {ask.question}</hx-p>
		<HubHomeChoices
			agent={ask}
			{busy}
			onpick={(number, confirmed) => {
				const option = ask.options[number - 1];
				if (option) void answerWith(option.label, { number, confirmed });
			}}
			onother={(text) => void answerWith(text)}
		/>
	</hx-section>
{:else if status}
	<hx-p class="po-sessions" role="status">{ask.agentName}: {status}</hx-p>
{/if}
{#if open && status}<hx-p role="status">{status}</hx-p>{/if}
