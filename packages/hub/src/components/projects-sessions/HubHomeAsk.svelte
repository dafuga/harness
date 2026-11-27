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
	import ViewSpecButtons from '$reports/components/explorer-ui/explorer-kit/ViewSpecButtons.svelte';
	import { hubSpecDocuments } from './hubSpecDocument';

	let {
		ask,
		send,
		receipt,
		submitted,
		row = false
	}: {
		ask: HomeOpenAsk;
		send: SendHomeChat;
		receipt: (id: string) => Promise<HomeChatReceipt>;
		submitted?: (message: HomeChatInput, receipt: HomeChatReceipt) => void;
		/** On a Home row, which already shows who asks and the question. */
		row?: boolean;
	} = $props();
	const load = hubSpecDocuments();
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
			} else if (result.status === 'refused')
				status =
					'Not sent: the question changed, or your Mac needs the latest Harness app. Check Tracker.';
			else status = 'The computer did not confirm the answer. Check Tracker before retrying.';
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

{#snippet choices(done?: () => void)}
	<HubHomeChoices
		agent={ask}
		{busy}
		onpick={(number, confirmed) => {
			const option = ask.options[number - 1];
			done?.();
			if (option) void answerWith(option.label, { number, confirmed });
		}}
		onother={(text) => {
			done?.();
			void answerWith(text);
		}}
	/>
{/snippet}

{#if open}
	<hx-section class="hh-ask" aria-label={`${ask.agentName} needs you`}>
		{#if !row}
			<hx-p class="hh-ask-question"><hx-strong>{ask.agentName}</hx-strong> · {ask.question}</hx-p>
		{/if}
		{#if ask.attachments?.length}
			<ViewSpecButtons attachments={ask.attachments} question={ask.question} {load}>
				{#snippet answers(close: () => void)}
					{@render choices(close)}
				{/snippet}
			</ViewSpecButtons>
		{/if}
		{@render choices()}
	</hx-section>
{:else if status}
	<hx-p class="po-sessions" role="status">{ask.agentName}: {status}</hx-p>
{/if}
{#if open && status}<hx-p role="status">{status}</hx-p>{/if}
