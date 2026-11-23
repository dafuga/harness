<!-- @harness-tier organism -->
<!-- @harness-atoms ../../../../reports/src/components/shared-primitives/atoms -->
<!-- @harness-uid u_wh4kg7lywd -->
<script lang="ts">
	import { onMount } from 'svelte';
	import type { ProviderState } from '../../models/development-tooling/Desktop.types';
	import { mockupModels } from '../../utils/explorer-ui/composeModes';
	import type { AgentChoice, ComposeMode, RunDraft } from '../../utils/explorer-ui/composeModes';
	import { agentSettings } from '../../lib/agents-providers/agent-settings/agentSettings.svelte';
	import AgentControls from '../agents-providers/AgentControls.svelte';
	import Notice from '$shared/explorer-ui/explorer-kit/Notice.svelte';
	let {
		modes,
		providers,
		approved,
		running,
		notice = '',
		failureReported = false,
		placeholder = '',
		opening = '',
		visual = false,
		fixedVisual = false,
		compact = false,
		comment,
		send
	}: {
		/** What this context allows, in any order: the field always shows Comment · Ask · Plan · Change. */
		modes: ComposeMode[];
		providers: ProviderState[];
		approved: boolean;
		running: boolean;
		notice?: string;
		/** Whether the parent already displays the current send failure. */
		failureReported?: boolean;
		/** What an agent request is asked to describe here, where it is not the next design. */
		placeholder?: string;
		/** What an empty conversation says in its field, in place of the mode's own hint. */
		opening?: string;
		/** Whether a Plan here asks for the device's number of visual design options. */
		visual?: boolean;
		/** Direct entity Plans use the mockup authoring models. */
		fixedVisual?: boolean;
		/** Whether its agent choices are icons that open pickers, where the request has little room. */
		compact?: boolean;
		comment: (text: string) => Promise<boolean>;
		send: (request: RunDraft) => Promise<boolean>;
	} = $props();
	const labels = { comment: 'Comment', ask: 'Ask', plan: 'Plan', change: 'Change' };
	/** One order everywhere; the caller's list decides only which modes appear and the default. */
	const order: ComposeMode[] = ['comment', 'ask', 'plan', 'change'];
	const shown = $derived(order.filter((item) => modes.includes(item)));
	let text = $state('');
	let failed = $state(false);
	let chosen = $state<ComposeMode | null>(null);
	let agent = $state<AgentChoice | null>(null);
	onMount(() => agentSettings.load());
	/** A mode that is no longer offered is not kept: the first offered one takes its place. */
	const mode = $derived(chosen && modes.includes(chosen) ? chosen : (modes[0] ?? null));
	const request = $derived(mode && mode !== 'comment' ? mode : null);
	/** Only a Plan of a visual unit has a count; Ask and Change ask for none, nor does a comment. */
	const counted = $derived(request === 'plan' && visual);
	const fixed = $derived(counted && fixedVisual);
	const author: AgentChoice = { provider: 'claude', model: mockupModels.author, effort: null };
	const selected = $derived(fixed ? author : agent);
	const unready = $derived(Boolean(request) && (!selected || (request === 'change' && !approved)));
	const blocked = $derived(!mode || running || !text.trim() || unready);
	const hint = $derived(notice || (mode ? 'For people. A comment never starts an agent.' : ''));
	const prompt = $derived.by(() => {
		if (opening) return opening;
		if (request === 'ask') return 'Ask a question…';
		return request ? placeholder || 'Describe the next design…' : 'Leave a comment…';
	});
	/** A comment goes to the comment operation; only Ask, Plan and Change become a run request. */
	async function submit() {
		if (blocked) return;
		const body = text.trim();
		const asked = counted ? { designOptions: agentSettings.designOptions } : {};
		const sent =
			request && selected
				? await send({ text: body, mode: request, ...selected, ...asked })
				: await comment(body);
		failed = !sent;
		if (sent) text = '';
	}
</script>

<hx-form
	class="composer"
	class:compact
	onsubmit={(event) => {
		event.preventDefault();
		void submit();
	}}
>
	<hx-textarea
		aria-label="Message"
		placeholder={prompt}
		bind:value={text}
		rows="3"
		disabled={!mode || running}
	></hx-textarea>
	{#if failed && !failureReported}<hx-p class="error" role="alert"
			>Couldn’t send. Your message is kept. Try again.</hx-p
		>{/if}
	{#if counted}<hx-small class="composer-hint"
			>Visual plan · {agentSettings.designOptions} design options</hx-small
		>{/if}
	{#if request === 'change' && !approved}
		<Notice>Approve the current exact design before sending changes.</Notice>
	{/if}
	{#if modes.length > 1}<hx-div class="mode-options" role="group" aria-label="Request mode">
			{#each shown as item (item)}<hx-button
					type="button"
					class:active={mode === item}
					aria-pressed={mode === item}
					disabled={item === 'change' && !approved}
					title={item === 'change' && !approved ? 'Approve the current exact design first' : ''}
					onclick={() => (chosen = item)}>{labels[item]}</hx-button
				>{/each}
		</hx-div>{/if}
	{#snippet action()}<hx-button
			class="primary send"
			aria-label={`Send ${mode === 'ask' ? 'question' : (mode ?? 'message')}`}
			disabled={blocked}>➤</hx-button
		>{/snippet}
	{#if request && !fixed}<AgentControls
			{providers}
			bind:choice={agent}
			{compact}
			{action}
		/>{:else}<hx-div class="composer-bottom">
			<hx-small class="composer-hint"
				>{fixed ? 'Sonnet mockups · Haiku sizes and states' : hint}</hx-small
			>{@render action()}
		</hx-div>{/if}
</hx-form>

<style>
	.composer:not(.compact) > .composer-hint {
		display: block;
		margin-top: var(--hx-space-8);
	}
	.composer:not(.compact) > :global(.ex-notice) {
		margin: var(--hx-space-8) 0 0;
	}
	/* Compact, what is asked shares one row with the icons that choose its agent, beside send. */
	.compact {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		gap: var(--hx-space-8);
		margin: 0;
		padding: var(--hx-space-10);
		font-size: var(--hx-type-size-xs);
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
		min-width: max-content;
		padding: var(--hx-space-6);
		font-size: inherit;
	}
	/* The modes are joined, so they read as one control. */
	.compact .mode-options button:not(:first-child) {
		margin-inline-start: calc(-1 * var(--hx-space-1));
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
		gap: var(--hx-space-5);
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
		font-size: var(--hx-type-size-base);
	}
	/* On a phone the modes are each still read whole. */
	@media (max-width: 520px) {
		.compact {
			font-size: var(--hx-type-size-2xs);
		}
	}
</style>
