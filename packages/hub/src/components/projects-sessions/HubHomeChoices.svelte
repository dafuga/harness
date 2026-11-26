<!-- @harness-tier organism -->
<!-- @harness-atoms ../../../../reports/src/components/shared-primitives/atoms -->
<!-- @harness-uid u_hh0ch01c3s -->
<!-- @harness-uid u_qoahc5zxzf -->
<script lang="ts">
	import type { HomeAgent } from '$reports/lib/projects-sessions/hub-home/hubHome.types';
	import OtherAnswerModal from '$reports/components/explorer-ui/explorer-kit/OtherAnswerModal.svelte';
	import { orderedChoices } from './hubHomeChoices';

	let {
		agent,
		busy = false,
		onpick,
		onother
	}: {
		agent: Pick<HomeAgent, 'options' | 'confirm' | 'question'>;
		busy?: boolean;
		/** Called with the option's 1-based number and whether the confirm step was done. */
		onpick: (number: number, confirmed: boolean) => void;
		/** Called with the answer written in the Other modal. */
		onother: (text: string) => void;
	} = $props();
	let writing = $state(false);

	const choices = $derived(orderedChoices(agent));
	let pending = $state<number | null>(null);
	const pendingChoice = $derived(choices.find((entry) => entry.number === pending) ?? null);

	function tap(number: number) {
		// Deploy, money and secret asks stop at a confirm step; other asks are answered by the tap.
		if (agent.confirm) pending = number;
		else onpick(number, false);
	}

	function confirm() {
		if (pending === null) return;
		const number = pending;
		pending = null;
		onpick(number, true);
	}
</script>

{#if choices.length >= 2}
	<hx-div class="hh-choices" role="group" aria-label="Choose an answer">
		{#each choices as { number, option } (number)}
			<hx-button
				type="button"
				class="hh-choice"
				data-recommended={option.recommended ? 'true' : undefined}
				disabled={busy}
				onclick={() => tap(number)}
			>
				<hx-strong>{option.label}</hx-strong>
				{#if option.recommended}<hx-span class="hh-choice-badge">Recommended</hx-span>{/if}
				{#if option.effect}<hx-span class="hh-choice-effect">{option.effect}</hx-span>{/if}
			</hx-button>
		{/each}
		<hx-button
			type="button"
			class="hh-choice hh-choice-other"
			aria-haspopup="dialog"
			disabled={busy}
			onclick={() => (writing = true)}
		>
			<hx-strong>Other…</hx-strong>
			<hx-span class="hh-choice-effect">Write a different answer.</hx-span>
		</hx-button>
		{#if writing}
			<OtherAnswerModal
				question={agent.question ?? ''}
				maxlength={2000}
				{busy}
				onsend={onother}
				onclose={() => (writing = false)}
			/>
		{/if}
		{#if pendingChoice && agent.confirm}
			<hx-div
				class="hh-choice-confirm"
				role="group"
				aria-label={`Confirm this ${agent.confirm} answer`}
			>
				<hx-p>
					This is a <hx-strong>{agent.confirm}</hx-strong> decision. Answer
					<hx-strong>{pendingChoice.option.label}</hx-strong>?
				</hx-p>
				<hx-div class="hh-quick-replies">
					<hx-button type="button" class="po-action hh-primary" disabled={busy} onclick={confirm}
						>Confirm answer</hx-button
					>
					<hx-button type="button" class="po-action" onclick={() => (pending = null)}
						>Cancel</hx-button
					>
				</hx-div>
			</hx-div>
		{/if}
	</hx-div>
{/if}
