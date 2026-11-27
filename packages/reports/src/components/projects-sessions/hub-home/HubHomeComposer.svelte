<!-- @harness-tier organism -->
<!-- @harness-atoms ../../shared-primitives/atoms -->
<!-- @harness-uid u_bizwcg2fkv -->
<script lang="ts">
	import HarnessIcon from '$reports/components/explorer-ui/HarnessIcon.svelte';
	import type {
		HomeAgent,
		HomeChatInput,
		HomeChatReceipt,
		SendHomeChat
	} from '$reports/lib/projects-sessions/hub-home/hubHome.types';
	import { currentAgent } from './hubHomePresentation';
	import {
		composerFeedback,
		composedMessage as composed,
		homeChatItemSuffix
	} from './hubHomeMessages';
	import type { HomeChatItemContext } from './hubHomeChatContext.types';

	let {
		agents,
		agentId,
		send,
		submitted,
		label = 'Message',
		draft = $bindable(''),
		pending = $bindable(false),
		feedback = $bindable(''),
		itemContext
	}: {
		agents: HomeAgent[];
		agentId?: string;
		/** The field's accessible name. */
		label?: string;
		draft?: string;
		pending?: boolean;
		feedback?: string;
		itemContext?: HomeChatItemContext;
		send: SendHomeChat;
		submitted?: (message: HomeChatInput, receipt: HomeChatReceipt) => void;
	} = $props();
	let recipient = $state('');
	const suffix = $derived(homeChatItemSuffix(itemContext));
	const maxLength = $derived(2000 - suffix.length);
	/** Chief of Staff is always reachable; another session needs a Tracker item to write to. */
	const options = $derived(agents.filter((agent) => agent.itemId || agent.id === 'cos'));
	const active = $derived(
		options.find((agent) => agent.id === (agentId ?? recipient)) ?? currentAgent(options)
	);

	async function post(event: SubmitEvent) {
		event.preventDefault();
		const text = draft.trim();
		if (!active || !text || pending || text.length > maxLength) return;
		const message = composed(active, text + suffix);
		if (!message) return;
		pending = true;
		feedback = '';
		try {
			const receipt = await send(message);
			submitted?.(message, receipt);
			if ((receipt.status === 'queued' || receipt.status === 'sent') && draft.trim() === text)
				draft = '';
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
			maxlength={maxLength}
			bind:value={draft}
		/>
		<hx-button
			class="hh-send"
			type="submit"
			aria-label="Send"
			disabled={pending || !draft.trim() || draft.trim().length > maxLength}
		>
			<HarnessIcon name="arrow-right" size={18} />
		</hx-button>
	</hx-form>
	{#if feedback}<hx-p class="po-item-meta" role="status">{feedback}</hx-p>{/if}
{/if}
