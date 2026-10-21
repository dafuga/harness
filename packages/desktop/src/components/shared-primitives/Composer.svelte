<script lang="ts">
	import { onMount } from 'svelte';
	import type { ProviderState } from '../../models/development-tooling/Desktop.types';
	import type { AgentChoice, ComposeMode, RunDraft } from '../../utils/explorer-ui/composeModes';
	import { agentSettings } from '../../lib/agents-providers/agent-settings/agentSettings.svelte';
	import AgentControls from '../agents-providers/AgentControls.svelte';
	let {
		modes,
		providers,
		approved,
		running,
		notice = '',
		placeholder = '',
		visual = false,
		compact = false,
		comment,
		send
	}: {
		/** What this context allows, Comment first. Empty when nothing can be sent. */
		modes: ComposeMode[];
		providers: ProviderState[];
		approved: boolean;
		running: boolean;
		notice?: string;
		/** What an agent request is asked to describe here, where it is not the next design. */
		placeholder?: string;
		/** Whether a Plan here makes images, so it asks for the device's number of design options. */
		visual?: boolean;
		/** Whether its agent choices are icons that open pickers, where the request has little room. */
		compact?: boolean;
		comment: (text: string) => Promise<boolean>;
		send: (request: RunDraft) => Promise<boolean>;
	} = $props();
	const labels = { comment: 'Comment', ask: 'Ask', plan: 'Plan', change: 'Change' };
	let text = $state('');
	let chosen = $state<ComposeMode | null>(null);
	let agent = $state<AgentChoice | null>(null);
	onMount(() => agentSettings.load());
	/** A mode that is no longer offered is not kept: the first offered one takes its place. */
	const mode = $derived(chosen && modes.includes(chosen) ? chosen : (modes[0] ?? null));
	const request = $derived(mode && mode !== 'comment' ? mode : null);
	/** Only a Plan of a visual unit has a count; Ask and Change ask for none, nor does a comment. */
	const counted = $derived(request === 'plan' && visual);
	const unready = $derived(Boolean(request) && (!agent || (request === 'change' && !approved)));
	const blocked = $derived(!mode || running || !text.trim() || unready);
	const hint = $derived(notice || (mode ? 'For people. A comment never starts an agent.' : ''));
	const prompt = $derived.by(() => {
		if (request === 'ask') return 'Ask a question…';
		return request ? placeholder || 'Describe the next design…' : 'Leave a comment…';
	});
	/** A comment goes to the comment operation; only Ask, Plan and Change become a run request. */
	async function submit() {
		if (blocked) return;
		const body = text.trim();
		const asked = counted ? { designOptions: agentSettings.designOptions } : {};
		const sent =
			request && agent
				? await send({ text: body, mode: request, ...agent, ...asked })
				: await comment(body);
		if (sent) text = '';
	}
</script>

<form
	class="composer"
	class:compact
	onsubmit={(event) => {
		event.preventDefault();
		void submit();
	}}
>
	<textarea
		aria-label="Message"
		placeholder={prompt}
		bind:value={text}
		rows="3"
		disabled={!mode || running}
	></textarea>
	{#if modes.length > 1}<div class="mode-options" role="group" aria-label="Request mode">
			{#each modes as item (item)}<button
					type="button"
					class:active={mode === item}
					aria-pressed={mode === item}
					disabled={item === 'change' && !approved}
					title={item === 'change' && !approved ? 'Approve the current exact design first' : ''}
					onclick={() => (chosen = item)}>{labels[item]}</button
				>{/each}
		</div>{/if}
	{#snippet action()}<button
			class="primary send"
			aria-label={`Send ${mode === 'ask' ? 'question' : (mode ?? 'message')}`}
			disabled={blocked}>➤</button
		>{/snippet}
	{#if request}<AgentControls {providers} bind:choice={agent} {compact} {action} />{:else}<div
			class="composer-bottom"
		>
			<small class="composer-hint">{hint}</small>{@render action()}
		</div>{/if}
</form>

<style>
	/* Compact, what is asked shares one row with the icons that choose its agent, beside send. */
	.compact {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 8px;
		margin: 0;
		padding: 10px;
		font-size: 12px;
	}
	.compact > :global(*) {
		grid-column: 1 / -1;
		margin: 0;
	}
	.compact > .mode-options {
		grid-column: auto;
		gap: 0;
	}
	.compact .mode-options button {
		min-width: 0;
		padding: 6px 8px;
		font-size: inherit;
	}
	/* The modes are joined, so they read as one control. */
	.compact .mode-options button:not(:first-child) {
		margin-inline-start: -1px;
		border-start-start-radius: 0;
		border-end-start-radius: 0;
	}
	.compact .mode-options button:not(:last-child) {
		border-start-end-radius: 0;
		border-end-end-radius: 0;
	}
	.compact :global(.active),
	.compact :global(button:focus-visible) {
		position: relative;
	}
	.compact :global(.composer-bottom) {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 34px;
		gap: 5px;
	}
	/* The model and effort icons sit at the end of the modes' row, beside send. */
	.compact > :global(.composer-bottom.agent-icons) {
		grid-column: 2;
		display: flex;
		justify-content: flex-end;
		align-items: center;
	}
	.compact :global(.agent-icon),
	.compact :global(.send) {
		display: inline-grid;
		place-items: center;
		flex: none;
		width: 34px;
		height: 34px;
		padding: 0;
	}
	.compact :global(.send) {
		font-size: 16px;
	}
	/* On a phone the modes are each still read whole. */
	@media (max-width: 520px) {
		.compact {
			font-size: 11px;
		}
	}
</style>
