<!-- @harness-tier organism -->
<!-- @harness-atoms ../../../../reports/src/components/shared-primitives/atoms -->
<!-- @harness-uid u_kncvbfcpto -->
<script lang="ts">
	import { tick } from 'svelte';
	import Modal from '$reports/components/Modal.svelte';
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

	const viewerUrl = 'https://browser-viewer.novaylo.com/';
	let viewerItem = $state<string>();
	let viewerButton: HTMLButtonElement | undefined;
	const viewerAsk = $derived(asks.find((ask) => ask.itemId === viewerItem && hasViewer(ask)));

	function hasViewer(ask: HomeOpenAsk): boolean {
		return ask.question.split(/\s+/u).includes(viewerUrl);
	}

	function displayQuestion(ask: HomeOpenAsk): string {
		return hasViewer(ask) ? ask.question.replace(viewerUrl, '').trim() || ask.title : ask.question;
	}

	async function closeViewer() {
		viewerItem = undefined;
		await tick();
		viewerButton?.focus();
	}
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
					<hx-button
						type="button"
						class="hh-needs-row"
						aria-haspopup="dialog"
						onclick={() => open('agents', ask.agentId)}
					>
						<hx-strong class="hh-needs-project">{ask.agentName}</hx-strong>
						<hx-span class="hh-needs-question">{displayQuestion(ask)}</hx-span>
						<hx-span class="hh-needs-age">waiting {waitAge(ask.since, now)}</hx-span>
					</hx-button>
					{#if hasViewer(ask)}
						<hx-button
							class="po-action hh-viewer-action"
							type="button"
							aria-haspopup="dialog"
							onclick={(event) => {
								viewerButton = event.currentTarget as HTMLButtonElement;
								viewerItem = ask.itemId;
							}}>Open browser viewer</hx-button
						>
					{:else}
						<HubHomeAsk {ask} {send} {receipt} row />
					{/if}
				</hx-li>
			{/each}
		</hx-ul>
	</hx-section>
{/if}

{#if viewerAsk}
	<Modal isOpen title="Browser viewer" variant="text" onClose={closeViewer}>
		<hx-div class="hh-viewer-detail">
			<hx-p>{displayQuestion(viewerAsk)}</hx-p>
			<hx-p>Sign in with Cloudflare and approve the device to control the browser on MB2.</hx-p>
			<hx-a class="po-action hh-primary" href={viewerUrl} target="_blank" rel="noopener noreferrer"
				>Continue to browser viewer</hx-a
			>
			<HubHomeAsk ask={viewerAsk} {send} {receipt} row />
		</hx-div>
	</Modal>
{/if}
