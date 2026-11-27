<!-- @harness-tier organism -->
<!-- @harness-atoms ../../../../reports/src/components/shared-primitives/atoms -->
<!-- @harness-uid u_kncvbfcpto -->
<script lang="ts">
	import LinkifiedText from '$reports/components/shared-primitives/LinkifiedText.svelte';
	import { hasWebLink } from '$reports/utils/strings/linkSegments';
	import type { Snippet } from 'svelte';
	import Pill from '$reports/components/explorer-ui/explorer-kit/Pill.svelte';
	import type {
		HomeChatReceipt,
		HomeOpenAsk
	} from '$reports/lib/projects-sessions/hub-home/hubHome.types';
	import { waitAge } from '$reports/lib/projects-sessions/hub-home/waitAge';
	import type { OpenHomeSection, SendHomeChat } from './hubHomeView.types';
	import HubHomeAsk from './HubHomeAsk.svelte';

	let {
		asks,
		now,
		open,
		send,
		receipt
	}: {
		asks: HomeOpenAsk[];
		now: number;
		open: OpenHomeSection;
		send: SendHomeChat;
		receipt: (id: string) => Promise<HomeChatReceipt>;
	} = $props();
	let detail = $state<{ itemId: string; question: string; content: Snippet } | null>(null);
	const activeDetail = $derived(
		asks.some((ask) => ask.itemId === detail?.itemId && ask.question === detail.question)
			? detail?.content
			: undefined
	);
</script>

{#if asks.length}
	<hx-section class="hh-needs" aria-labelledby="hh-needs-title">
		<hx-div class="hh-needs-head">
			<hx-h2 class="hh-needs-title" id="hh-needs-title">Blocked - needs you</hx-h2>
			<Pill tone="hh-tone po-state po-needs-you" state="needs-you"
				><hx-span class="po-mark" aria-hidden="true"></hx-span>{asks.length}
				{asks.length === 1 ? 'needs' : 'need'} you</Pill
			>
		</hx-div>
		<hx-ul class="hh-needs-list">
			{#each asks as ask (ask.itemId)}
				<hx-li class="hh-needs-item">
					{#if hasWebLink(ask.question)}
						<hx-div class="hh-needs-row hh-needs-linked">
							<hx-strong class="hh-needs-project">{ask.agentName}</hx-strong>
							<hx-span class="hh-needs-question"><LinkifiedText text={ask.question} /></hx-span>
							<hx-span class="hh-needs-age">waiting {waitAge(ask.since, now)}</hx-span>
							<hx-button
								type="button"
								class="po-action"
								aria-haspopup="dialog"
								aria-label={`View details for ${ask.agentName}`}
								onclick={() => open('agents', ask.agentId)}>View details</hx-button
							>
						</hx-div>
					{:else}
						<hx-button
							type="button"
							class="hh-needs-row"
							aria-haspopup="dialog"
							onclick={() => open('agents', ask.agentId)}
						>
							<hx-strong class="hh-needs-project">{ask.agentName}</hx-strong>
							<hx-span class="hh-needs-question">{ask.question}</hx-span>
							<hx-span class="hh-needs-age">waiting {waitAge(ask.since, now)}</hx-span>
						</hx-button>
					{/if}
					<HubHomeAsk
						{ask}
						{send}
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
