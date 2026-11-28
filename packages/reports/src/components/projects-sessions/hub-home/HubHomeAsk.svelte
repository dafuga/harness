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
	import { askKey, homeCosChat } from './hubHomeChatContext.svelte';

	let {
		ask,
		send,
		receipt,
		submitted,
		present,
		kicker
	}: {
		ask: HomeOpenAsk;
		send: SendHomeChat;
		receipt: (id: string) => Promise<HomeChatReceipt>;
		submitted?: (message: HomeChatInput, receipt: HomeChatReceipt) => void;
		/** A Home row presents its dialogs beside the list. */
		present?: (content: Snippet | null) => void;
		/** Heads the question where the agent is already named, as in the agents dock. */
		kicker?: string;
	} = $props();
	const load = hubSpecDocuments();
	const feedback: Record<HomeChatStatus | 'sending', string> = {
		sending: 'Sending answer…',
		queued: 'Answer queued',
		sent: 'Answer sent',
		refused: 'Answer not sent. Check the latest question and try again.',
		unconfirmed: 'Tracker did not confirm the answer. Check Tracker before retrying.'
	};
	const chat = homeCosChat();
	const version = $derived(askKey(ask));
	const shared = $derived(chat?.answers.get(version));
	let submission = $state<{ version: string; phase: keyof typeof feedback } | null>(null);
	const phase = $derived(submission?.version === version ? submission.phase : null);
	const busy = $derived(phase === 'sending' || phase === 'queued' || Boolean(shared));
	const open = $derived(!shared?.dismissed && (phase !== 'sent' || Boolean(present && shared)));
	const feedbackText = $derived(shared?.status ?? (phase ? feedback[phase] : null));

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
		const question = ask;
		const reviewed = version;
		report(question, message, 'sending');
		try {
			const result = await send(message);
			if (version !== reviewed) return;
			submitted?.(message, result);
			await settle(question, message, result);
		} catch {
			if (version === reviewed) report(question, message, 'unconfirmed');
		}
	}

	function report(
		question: HomeOpenAsk,
		message: HomeChatInput,
		next: keyof typeof feedback,
		dismissed = false
	) {
		const key = askKey(question);
		submission = { version: key, phase: next };
		if (next === 'refused' || next === 'unconfirmed') chat?.answers.delete(key);
		else
			chat?.answers.set(key, {
				ask: question,
				status: `${feedback[next]} · ${message.text}`,
				selection: message.option,
				dismissed
			});
	}

	async function settle(question: HomeOpenAsk, message: HomeChatInput, result: HomeChatReceipt) {
		const reviewed = askKey(question);
		report(question, message, result.status);
		for (let attempt = 0; attempt < 15 && result.status === 'queued'; attempt++) {
			await new Promise((done) => setTimeout(done, 2000));
			if (version !== reviewed) return;
			result = await receipt(result.id).catch(() => result);
			if (version !== reviewed) return;
			report(question, message, result.status);
		}
		if (result.status === 'queued') report(question, message, 'unconfirmed');
		if (result.status === 'sent') {
			await new Promise((done) => setTimeout(done, 900));
			if (version === reviewed) report(question, message, 'sent', true);
		}
	}
</script>

{#snippet choices(done?: () => void)}
	{#key version}
		<HubHomeChoices
			agent={ask}
			{busy}
			selected={shared?.selection}
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
			{#if kicker}
				<hx-p class="hh-ask-kicker">{kicker}</hx-p>
				<hx-p class="hh-ask-question"
					><hx-strong><LinkifiedText text={ask.question} /></hx-strong></hx-p
				>
			{:else}
				<hx-p class="hh-ask-question"
					><hx-strong>{ask.agentName}</hx-strong> · <LinkifiedText text={ask.question} /></hx-p
				>
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
	{/if}
{/if}
{#if feedbackText}
	<hx-p class="po-sessions hh-answer-feedback" role="status">{ask.agentName}: {feedbackText}</hx-p>
{/if}
