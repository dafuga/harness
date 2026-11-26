<!-- @harness-tier organism -->
<!-- @harness-atoms ../../../../reports/src/components/shared-primitives/atoms -->
<!-- @harness-uid u_kncvbfcpto -->
<script lang="ts">
	import type { HomeOpenAsk } from '$reports/lib/projects-sessions/hub-home/hubHome.types';
	import { waitAge } from '$reports/lib/projects-sessions/hub-home/waitAge';
	import type { HomeChatReceipt } from '$reports/lib/projects-sessions/hub-home/hubHome.types';
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
</script>

{#if asks.length}
	<hx-section class="hh-needs" aria-labelledby="hh-needs-title">
		<hx-h2 class="hh-needs-title" id="hh-needs-title"
			>Blocked - needs you <hx-span class="po-band-count">{asks.length}</hx-span></hx-h2
		>
		<hx-ul class="hh-needs-list">
			{#each asks as ask (ask.itemId)}
				<hx-li class="hh-needs-item">
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
					<HubHomeAsk {ask} {send} {receipt} row />
				</hx-li>
			{/each}
		</hx-ul>
	</hx-section>
{/if}
