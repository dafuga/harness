<!-- @harness-tier molecule -->
<!-- @harness-atoms ../../../../reports/src/components/shared-primitives/atoms -->
<!-- @harness-uid u_bizwcg2fkv -->
<script lang="ts">
	import HarnessIcon from '$shared/explorer-ui/HarnessIcon.svelte';
	import type {
		HomeAgent,
		HomeChatInput,
		HomeChatReceipt
	} from '$reports/lib/projects-sessions/hub-home/hubHome.types';
	import { currentAgent } from './hubHomePresentation';
	import type { SendHomeChat } from './hubHomeView.types';

	let {
		agents,
		agentId,
		send,
		submitted
	}: {
		agents: HomeAgent[];
		agentId?: string;
		send: SendHomeChat;
		submitted?: (message: HomeChatInput, receipt: HomeChatReceipt) => void;
	} = $props();
	let recipient = $state('');
	let draft = $state('');
	let pending = $state(false);
	let feedback = $state('');
	const options = $derived(agents.filter((agent) => agent.itemId));
	const active = $derived(
		options.find((agent) => agent.id === (agentId ?? recipient)) ?? currentAgent(options)
	);

	async function post(event: SubmitEvent) {
		event.preventDefault();
		const text = draft.trim();
		if (!active?.itemId || !text || pending) return;
		const message: HomeChatInput = {
			id: crypto.randomUUID(),
			agentId: active.id,
			itemId: active.itemId,
			text,
			kind: 'note',
			question: null
		};
		pending = true;
		feedback = '';
		try {
			const receipt = await send(message);
			submitted?.(message, receipt);
			if (receipt.status === 'queued' || receipt.status === 'sent') draft = '';
			feedback =
				receipt.status === 'queued'
					? 'Queued for Tracker'
					: receipt.status === 'sent'
						? 'Sent to Tracker'
						: 'Tracker did not accept the message.';
		} catch {
			feedback = 'Could not queue the message. Check Tracker before retrying.';
		} finally {
			pending = false;
		}
	}
</script>

{#if active}
	<hx-form class="hh-composer" onsubmit={post}>
		{#if !agentId}
			<hx-label class="hh-composer-to">
				<hx-span class="hh-sr">To</hx-span>
				<hx-select
					class="hh-to-chip"
					value={active.id}
					onchange={(event) => (recipient = event.currentTarget.value)}
				>
					{#each options as option (option.id)}
						<hx-option value={option.id}>{option.name}</hx-option>
					{/each}
				</hx-select>
			</hx-label>
		{/if}
		<hx-input
			class="hh-composer-input"
			placeholder={`Message ${active.name}…`}
			aria-label="Message"
			maxlength={2000}
			bind:value={draft}
		/>
		<hx-button class="hh-send" type="submit" aria-label="Send" disabled={pending || !draft.trim()}>
			<HarnessIcon name="arrow-right" size={18} />
		</hx-button>
	</hx-form>
	{#if feedback}<hx-p class="po-item-meta" role="status">{feedback}</hx-p>{/if}
{/if}
