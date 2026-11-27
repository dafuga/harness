<!-- @harness-tier organism -->
<!-- @harness-atoms ../../shared-primitives/atoms -->
<!-- @harness-uid u_5hn7c2wq8d -->
<!-- @harness-uid u_gnhmm7tirz -->
<script lang="ts">
	import LinkifiedText from '$reports/components/shared-primitives/LinkifiedText.svelte';
	import type { Snippet } from 'svelte';
	import type {
		HomeChatInput,
		HomeChatReceipt,
		HomeChatStatus,
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
		present
	}: {
		ask: HomeOpenAsk;
		send: SendHomeChat;
		receipt: (id: string) => Promise<HomeChatReceipt>;
		submitted?: (message: HomeChatInput, receipt: HomeChatReceipt) => void;
		/** A Home row presents its dialogs beside the list. */
		present?: (content: Snippet | null) => void;
	} = $props();
	const load = hubSpecDocuments();
	const feedback: Record<HomeChatStatus | 'sending', string> = {
		sending: 'Sending answer…',
		queued: 'Answer queued',
		sent: 'Answer sent',
		refused: 'Answer not sent. Check the latest question and try again.',
		unconfirmed: 'Tracker did not confirm the answer. Check Tracker before retrying.'
	};
	const version = $derived(JSON.stringify([ask.itemId, ask.question, ask.since]));
	let submission = $state<{ version: string; phase: keyof typeof feedback } | null>(null);
	const phase = $derived(submission?.version === version ? submission.phase : null);
	const busy = $derived(phase === 'sending' || phase === 'queued');
	const open = $derived(phase !== 'sent');

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
		const reviewed = version;
		submission = { version: reviewed, phase: 'sending' };
		try {
			const result = await send(message);
			if (version !== reviewed) return;
			submitted?.(message, result);
			await settle(reviewed, result);
		} catch {
			if (version === reviewed) submission = { version: reviewed, phase: 'unconfirmed' };
		}
	}

	async function settle(reviewed: string, result: HomeChatReceipt) {
		submission = { version: reviewed, phase: result.status };
		for (let attempt = 0; attempt < 15 && result.status === 'queued'; attempt++) {
			await new Promise((done) => setTimeout(done, 2000));
			if (version !== reviewed) return;
			result = await receipt(result.id).catch(() => result);
			if (version !== reviewed) return;
			submission = { version: reviewed, phase: result.status };
		}
		if (result.status === 'queued') submission = { version: reviewed, phase: 'unconfirmed' };
	}
</script>

{#snippet choices(done?: () => void)}
	{#key version}
		<HubHomeChoices
			agent={ask}
			{busy}
			{present}
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
	{/key}
{/snippet}

{#if open}
	{#if present}
		{@render choices()}
	{:else}
		<hx-section class="hh-ask" aria-label={`${ask.agentName} needs you`}>
			<hx-p class="hh-ask-question"
				><hx-strong>{ask.agentName}</hx-strong> · <LinkifiedText text={ask.question} /></hx-p
			>
			{#if ask.attachments?.length}
				<ViewSpecButtons attachments={ask.attachments} question={ask.question} {load}>
					{#snippet answers(close: () => void)}
						{@render choices(close)}
					{/snippet}
				</ViewSpecButtons>
			{/if}
			{@render choices()}
		</hx-section>
	{/if}
{/if}
{#if phase}<hx-p class="po-sessions" role="status">{ask.agentName}: {feedback[phase]}</hx-p>{/if}
