<!-- @harness-tier organism -->
<!-- @harness-atoms ../../shared-primitives/atoms -->
<!-- @harness-uid u_5hn7c2wq8d -->
<!-- @harness-uid u_gnhmm7tirz -->
<script lang="ts">
	import { askKey, homeCosChat } from './hubHomeChatContext.svelte';
	import LinkifiedText from '$reports/components/shared-primitives/LinkifiedText.svelte';
	import type { Snippet } from 'svelte';
	import type {
		HomeChatInput,
		HomeChatReceipt,
		HomeOpenAsk,
		SendHomeChat
	} from '$reports/lib/projects-sessions/hub-home/hubHome.types';
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
	const chat = homeCosChat();
	const shared = $derived(chat?.answers.get(askKey(ask)));
	let busy = $state(false);
	let status = $state('');
	let selection = $state<number>();
	/** The question this card already answered, so it hides until the Tracker shows a new one. */
	let answered = $state<string | null>(null);
	const open = $derived(answered !== ask.question && !shared);
	const compact = $derived(Boolean(present && shared && !shared.dismissed));
	function report(question: HomeOpenAsk, text: string, dismissed = false) {
		status = text;
		chat?.answers.set(askKey(question), {
			ask: question,
			status: text,
			selection: question === ask ? selection : undefined,
			dismissed
		});
	}

	async function answerWith(text: string, tap?: { number: number; confirmed: boolean }) {
		if (!text.trim() || busy || shared) return;
		const question = ask;
		selection = tap?.number;
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
		report(question, `Sending · ${message.text}`);
		try {
			const result = await send(message);
			submitted?.(message, result);
			if (result.status === 'queued' || result.status === 'sent') {
				answered = message.question;
				void settle(question, message, result);
			} else if (result.status === 'refused')
				status =
					'Not sent: the question changed, or your Mac needs the latest Harness app. Check Tracker.';
			else status = 'The computer did not confirm the answer. Check Tracker before retrying.';
		} catch {
			status = 'Could not queue the answer. Check Tracker before retrying.';
		} finally {
			busy = false;
			if (answered !== question.question) chat?.answers.delete(askKey(question));
		}
	}

	async function settle(question: HomeOpenAsk, message: HomeChatInput, first: HomeChatReceipt) {
		report(question, `Answer ${first.status} · ${message.text}`);
		for (let attempt = 0; attempt < 15 && first.status === 'queued'; attempt++) {
			await new Promise((done) => setTimeout(done, 2000));
			first = await receipt(message.id).catch(() => first);
			report(question, `Answer ${first.status} · ${message.text}`);
		}
		if (first.status === 'sent') {
			await new Promise((done) => setTimeout(done, 900));
			report(question, status, true);
		} else {
			if (first.status === 'refused') answered = null;
			chat?.answers.delete(askKey(question));
		}
	}
</script>

{#snippet choices(done?: () => void)}
	<HubHomeChoices
		agent={ask}
		busy={busy || Boolean(shared)}
		selected={shared?.selection ?? selection}
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
{/snippet}

{#if open || compact}
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
{:else if shared || status}
	<hx-p class="po-sessions" role="status">{ask.agentName}: {shared?.status ?? status}</hx-p>
{/if}
{#if compact || (open && status)}<hx-p class="po-sessions hh-answer-feedback" role="status"
		>{shared?.status ?? status}</hx-p
	>{/if}
