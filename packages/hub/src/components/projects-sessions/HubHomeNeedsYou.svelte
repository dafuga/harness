<!-- @harness-tier organism -->
<!-- @harness-atoms ../../../../reports/src/components/shared-primitives/atoms -->
<!-- @harness-uid u_kncvbfcpto -->
<script lang="ts">
	import LinkifiedText from '$reports/components/shared-primitives/LinkifiedText.svelte';
	import { homeCosChat } from './hubHomeChatContext.svelte';
	import type { Snippet } from 'svelte';
	import { MediaQuery, SvelteMap, SvelteSet } from 'svelte/reactivity';
	import { slide } from 'svelte/transition';
	import Pill from '$reports/components/explorer-ui/explorer-kit/Pill.svelte';
	import type {
		HomeChatReceipt,
		HomeOpenAsk
	} from '$reports/lib/projects-sessions/hub-home/hubHome.types';
	import { waitAge } from '$reports/lib/projects-sessions/hub-home/waitAge';
	import type { SendHomeChat } from './hubHomeView.types';
	import HubHomeAsk from './HubHomeAsk.svelte';

	let {
		asks,
		now,
		send,
		receipt
	}: {
		asks: HomeOpenAsk[];
		now: number;
		send: SendHomeChat;
		receipt: (id: string) => Promise<HomeChatReceipt>;
	} = $props();
	const chat = homeCosChat();
	let detail = $state<{ itemId: string; question: string; content: Snippet } | null>(null);
	const reduceMotion = new MediaQuery('(prefers-reduced-motion: reduce)');
	const pinned = new SvelteMap<string, { ask: HomeOpenAsk; index: number }>();
	const dismissed = new SvelteSet<string>();
	const key = (ask: HomeOpenAsk) => JSON.stringify([ask.itemId, ask.question]);
	const shown = $derived.by(() => {
		const list = asks.filter((ask) => !dismissed.has(key(ask)));
		for (const [id, held] of pinned) {
			if (!list.some((ask) => key(ask) === id)) list.splice(held.index, 0, held.ask);
		}
		return list;
	});
	$effect(() => {
		for (const id of dismissed) if (!asks.some((ask) => key(ask) === id)) dismissed.delete(id);
	});

	function sendAnswer(ask: HomeOpenAsk): SendHomeChat {
		return async (message) => {
			const id = key(ask);
			pinned.set(id, { ask, index: shown.findIndex((entry) => key(entry) === id) });
			try {
				const result = await send(message);
				if (!['queued', 'sent'].includes(result.status)) pinned.delete(id);
				return result;
			} catch (error) {
				pinned.delete(id);
				throw error;
			}
		};
	}

	function finish(ask: HomeOpenAsk, sent: boolean) {
		const id = key(ask);
		if (sent) dismissed.add(id);
		pinned.delete(id);
	}
	const activeDetail = $derived(
		asks.some((ask) => ask.itemId === detail?.itemId && ask.question === detail.question)
			? detail?.content
			: undefined
	);
</script>

{#if shown.length}
	<hx-section class="hh-needs" aria-labelledby="hh-needs-title">
		<hx-div class="hh-needs-head">
			<hx-h2 class="hh-needs-title" id="hh-needs-title">Blocked - needs you</hx-h2>
			<Pill tone="hh-tone po-state po-needs-you" state="needs-you"
				><hx-span class="po-mark" aria-hidden="true"></hx-span>{shown.length}
				{shown.length === 1 ? 'needs' : 'need'} you</Pill
			>
		</hx-div>
		<hx-ul class="hh-needs-list">
			{#each shown as ask (key(ask))}
				<hx-li
					class="hh-needs-item"
					out:slide|global={{ duration: reduceMotion.current ? 0 : 320 }}
				>
					<hx-div class="hh-needs-row hh-needs-linked">
						<hx-strong class="hh-needs-project">{ask.agentName}</hx-strong>
						<hx-span class="hh-needs-question"><LinkifiedText text={ask.question} /></hx-span>
						<hx-span class="hh-needs-age">waiting {waitAge(ask.since, now)}</hx-span>
						<hx-button
							id={`hh-ask-${ask.itemId}`}
							type="button"
							class="po-action hh-needs-talk"
							aria-haspopup="dialog"
							onclick={(event) => chat?.openAsk(event.currentTarget, ask.itemId)}
							>Talk to Chief of Staff</hx-button
						>
					</hx-div>
					<HubHomeAsk
						{ask}
						send={sendAnswer(ask)}
						finished={(sent) => finish(ask, sent)}
						{receipt}
						present={(content) =>
							(detail = content ? { itemId: ask.itemId, question: ask.question, content } : null)}
					/>
				</hx-li>
			{/each}
		</hx-ul>
		{@render activeDetail?.()}
	</hx-section>
{/if}
