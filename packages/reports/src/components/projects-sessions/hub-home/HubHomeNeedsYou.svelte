<!-- @harness-tier organism -->
<!-- @harness-atoms ../../shared-primitives/atoms -->
<!-- @harness-uid u_kncvbfcpto -->
<script lang="ts">
	import LinkifiedText from '$reports/components/shared-primitives/LinkifiedText.svelte';
	import { askKey, homeCosChat, provideHomeCosChat } from './hubHomeChatContext.svelte';
	import type { Snippet } from 'svelte';
	import { MediaQuery } from 'svelte/reactivity';
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
		reading = 'ready',
		send,
		receipt
	}: {
		asks: HomeOpenAsk[];
		now: number;
		/** Whether Home has received a snapshot that can establish the blocker count. */
		reading?: 'loading' | 'ready' | 'unavailable';
		send: SendHomeChat;
		receipt: (id: string) => Promise<HomeChatReceipt>;
	} = $props();
	const chat = homeCosChat() ?? provideHomeCosChat();
	let detail = $state<{ key: string; content: Snippet } | null>(null);
	const reduceMotion = new MediaQuery('(prefers-reduced-motion: reduce)');
	// Keep existing rows in place as snapshots arrive, including when a different ask is reflagged.
	let order = new Map<string, number>();
	const shown = $derived.by(() => {
		const list = asks.filter((ask) => !chat.answers.get(askKey(ask))?.dismissed);
		for (const held of chat.answers.values()) {
			if (held.dismissed || asks.some((ask) => ask.itemId === held.ask.itemId)) continue;
			list.push(held.ask);
		}
		return list.sort(
			(a, b) => (order.get(a.itemId) ?? order.size) - (order.get(b.itemId) ?? order.size)
		);
	});
	$effect(() => {
		order = new Map(shown.map((ask, index) => [ask.itemId, index]));
		for (const [key, held] of chat.answers) {
			const current = asks.find((ask) => ask.itemId === held.ask.itemId);
			if (current ? askKey(current) !== key : held.dismissed) chat.answers.delete(key);
		}
	});
	const activeDetail = $derived(
		asks.some((ask) => askKey(ask) === detail?.key) ? detail?.content : undefined
	);
</script>

<hx-section class="hh-needs" aria-labelledby="hh-needs-title">
	<hx-div class="hh-needs-head">
		<hx-h2 class="hh-needs-title" id="hh-needs-title">Blocked - needs you</hx-h2>
		{#if shown.length}<Pill tone="hh-tone po-state po-needs-you" state="needs-you"
				><hx-span class="po-mark" aria-hidden="true"></hx-span>{shown.length}
				{shown.length === 1 ? 'needs' : 'need'} you</Pill
			>
		{:else if reading === 'ready'}<hx-span class="po-sessions">0</hx-span>{/if}
	</hx-div>
	{#if shown.length}<hx-ul class="hh-needs-list">
			{#each shown as ask (ask.itemId)}
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
						{send}
						{receipt}
						present={(content) => (detail = content ? { key: askKey(ask), content } : null)}
					/>
				</hx-li>
			{/each}
		</hx-ul>
	{:else}
		<hx-p class="po-sessions hh-answer-feedback"
			>{reading === 'ready'
				? 'Nothing needs you right now'
				: reading === 'loading'
					? 'Checking for blockers…'
					: 'Blockers are unavailable.'}</hx-p
		>
	{/if}
	{@render activeDetail?.()}
</hx-section>
