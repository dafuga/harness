<script lang="ts">
	import type { ProviderState } from '../models/Desktop.types';
	import { defaultDesignCount } from '../utils/composeModes';
	import type { AgentChoice, ComposeMode, RunDraft } from '../utils/composeModes';
	import AgentControls from './AgentControls.svelte';
	let {
		modes,
		providers,
		approved,
		running,
		notice = '',
		placeholder = '',
		visual = false,
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
		/** Whether a Plan here makes images, so it asks for a number of design options. */
		visual?: boolean;
		comment: (text: string) => Promise<boolean>;
		send: (request: RunDraft) => Promise<boolean>;
	} = $props();
	const labels = { comment: 'Comment', plan: 'Plan', change: 'Change' };
	let text = $state('');
	let chosen = $state<ComposeMode | null>(null);
	let agent = $state<AgentChoice | null>(null);
	let designs = $state(defaultDesignCount);
	/** A mode that is no longer offered is not kept: the first offered one takes its place. */
	const mode = $derived(chosen && modes.includes(chosen) ? chosen : (modes[0] ?? null));
	const request = $derived(mode === 'plan' || mode === 'change' ? mode : null);
	/** Only a Plan of a visual unit has a count; a Change implements, and a comment asks nothing. */
	const counted = $derived(request === 'plan' && visual);
	const unready = $derived(Boolean(request) && (!agent || (request === 'change' && !approved)));
	const blocked = $derived(!mode || running || !text.trim() || unready);
	const hint = $derived(notice || (mode ? 'For people. A comment never starts an agent.' : ''));
	/** A comment goes to the comment operation; only Plan and Change become a run request. */
	async function submit() {
		if (blocked) return;
		const body = text.trim();
		const asked = counted ? { designOptions: designs } : {};
		const sent =
			request && agent
				? await send({ text: body, mode: request, ...agent, ...asked })
				: await comment(body);
		if (sent) text = '';
	}
</script>

<form
	class="composer"
	onsubmit={(event) => {
		event.preventDefault();
		void submit();
	}}
>
	<textarea
		aria-label="Message"
		placeholder={request ? placeholder || 'Describe the next design…' : 'Leave a comment…'}
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
			aria-label={`Send ${mode ?? 'message'}`}
			disabled={blocked}>➤</button
		>{/snippet}
	{#if request}<AgentControls
			{providers}
			bind:choice={agent}
			bind:count={designs}
			{counted}
			{action}
		/>{:else}<div class="composer-bottom">
			<small class="composer-hint">{hint}</small>{@render action()}
		</div>{/if}
</form>
