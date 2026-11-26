<!-- @harness-tier organism -->
<!-- @harness-atoms ../../../../reports/src/components/shared-primitives/atoms -->
<!-- @harness-uid u_bizwcg2fkv -->
<script lang="ts">
	import HarnessIcon from '$reports/components/explorer-ui/HarnessIcon.svelte';
	import type {
		HomeAgent,
		HomeChatInput,
		HomeChatReceipt
	} from '$reports/lib/projects-sessions/hub-home/hubHome.types';
	import { currentAgent } from './hubHomePresentation';
	import { composerFeedback, composedMessage as composed } from './hubHomeMessages';
	import type { SendHomeChat } from './hubHomeView.types';

	let {
		agents,
		agentId,
		send,
		submitted,
		label = 'Message'
	}: {
		agents: HomeAgent[];
		agentId?: string;
		/** The field's accessible name. */
		label?: string;
		send: SendHomeChat;
		submitted?: (message: HomeChatInput, receipt: HomeChatReceipt) => void;
	} = $props();
	let recipient = $state('');
	let draft = $state('');
	let pending = $state(false);
	let feedback = $state('');
	/** Chief of Staff is always reachable; another session needs a Tracker item to write to. */
	const options = $derived(agents.filter((agent) => agent.itemId || agent.id === 'cos'));
	const active = $derived(
		options.find((agent) => agent.id === (agentId ?? recipient)) ?? currentAgent(options)
	);

	async function post(event: SubmitEvent) {
		event.preventDefault();
		const text = draft.trim();
		if (!active || !text || pending) return;
		const message = composed(active, text);
		if (!message) return;
		pending = true;
		feedback = '';
		try {
			const receipt = await send(message);
			submitted?.(message, receipt);
			if (receipt.status === 'queued' || receipt.status === 'sent') draft = '';
			feedback = composerFeedback(message, receipt, active.name);
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
			aria-label={label}
			maxlength={2000}
			bind:value={draft}
		/>
		<hx-button class="hh-send" type="submit" aria-label="Send" disabled={pending || !draft.trim()}>
			<HarnessIcon name="arrow-right" size={18} />
		</hx-button>
	</hx-form>
	{#if feedback}<hx-p class="po-item-meta" role="status">{feedback}</hx-p>{/if}
{/if}
