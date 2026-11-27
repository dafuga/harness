<!-- @harness-tier organism -->
<!-- @harness-atoms ../../shared-primitives/atoms -->
<!-- @harness-uid u_hh0ch01c3s -->
<!-- @harness-uid u_qoahc5zxzf -->
<script lang="ts">
	import LinkifiedText from '$reports/components/shared-primitives/LinkifiedText.svelte';
	import { hasWebLink } from '$reports/utils/strings/linkSegments';
	import { tick, type Snippet } from 'svelte';
	import Modal from '$reports/components/Modal.svelte';
	import type { HomeAgent } from '$reports/lib/projects-sessions/hub-home/hubHome.types';
	import OtherAnswerModal from '$reports/components/explorer-ui/explorer-kit/OtherAnswerModal.svelte';
	import { orderedChoices } from './hubHomeChoices';
	import type { HomeChoice } from './hubHomeChoices.types';

	let {
		agent,
		busy = false,
		selected,
		onpick,
		onother,
		present
	}: {
		agent: Pick<HomeAgent, 'options' | 'confirm' | 'question'>;
		busy?: boolean;
		/** Option whose answer is being sent or has been acknowledged. */
		selected?: number;
		/** Called with the option's 1-based number and whether the confirm step was done. */
		onpick: (number: number, confirmed: boolean) => void;
		/** Called with the answer written in the Other modal. */
		onother: (text: string) => void;
		/** When supplied, show compact chips and present their dialogs outside the list. */
		present?: (content: Snippet | null) => void;
	} = $props();
	let writing = $state(false);

	const choices = $derived(orderedChoices(agent));
	let pending = $state<number | null>(null);
	const pendingChoice = $derived(choices.find((entry) => entry.number === pending) ?? null);

	let opener: HTMLElement | null = null;

	function openDetail(content: Snippet, trigger: HTMLElement) {
		opener = trigger;
		present?.(content);
	}

	function closeDetail() {
		pending = null;
		writing = false;
		if (!present) return;
		present(null);
		const target = opener;
		opener = null;
		void tick().then(() => target?.focus());
	}

	function tap(number: number, trigger: HTMLElement) {
		if (!agent.confirm) {
			onpick(number, false);
			return;
		}
		pending = number;
		if (present) openDetail(confirmDialog, trigger);
	}

	function confirm() {
		if (pending === null) return;
		const number = pending;
		closeDetail();
		onpick(number, true);
	}
</script>

{#if choices.length >= 2}
	<hx-div
		class="hh-choices"
		class:hh-choices-compact={present}
		role="group"
		aria-label="Choose an answer"
	>
		{#each choices as { number, option } (number)}
			{@const linkedLabel = hasWebLink(option.label)}
			{@const linkedEffect = !present && option.effect && hasWebLink(option.effect)}
			{#if linkedLabel || linkedEffect}
				<hx-div
					class="hh-choice hh-choice-linked"
					data-chosen={busy && number === selected ? true : undefined}
					data-recommended={option.recommended || undefined}
				>
					{#if linkedLabel}
						<hx-strong><LinkifiedText text={option.label} /></hx-strong>
						{@render badge(option.recommended)}
					{/if}
					{@render choiceButton(number, option, linkedLabel, Boolean(linkedEffect))}
					{#if linkedEffect && option.effect}
						<hx-span class="hh-choice-effect"><LinkifiedText text={option.effect} /></hx-span>
					{/if}
				</hx-div>
			{:else}
				{@render choiceButton(number, option, false, false)}
			{/if}
		{/each}
		<hx-button
			type="button"
			class="hh-choice hh-choice-other"
			aria-haspopup="dialog"
			disabled={busy}
			onclick={(event) => {
				if (present) openDetail(otherDialog, event.currentTarget);
				else writing = true;
			}}
		>
			<hx-strong>Other…</hx-strong>
			{#if !present}<hx-span class="hh-choice-effect">Write a different answer.</hx-span>{/if}
		</hx-button>
		{#if writing}{@render otherDialog()}{/if}
		{#if !present}{@render confirmation()}{/if}
	</hx-div>
{/if}

{#snippet badge(recommended?: boolean)}
	{#if recommended}<hx-span class="hh-choice-badge">Recommended</hx-span>{/if}
{/snippet}

{#snippet choiceButton(
	number: number,
	option: HomeChoice['option'],
	linkedLabel: boolean,
	linkedEffect: boolean
)}
	<hx-button
		type="button"
		class={linkedLabel || linkedEffect ? 'po-action hh-linked-pick' : 'hh-choice'}
		data-chosen={busy && number === selected ? true : undefined}
		data-recommended={option.recommended ? 'true' : undefined}
		disabled={busy}
		aria-haspopup={present && agent.confirm ? 'dialog' : undefined}
		aria-label={linkedLabel ? `Choose ${option.label}` : undefined}
		onclick={(event) => tap(number, event.currentTarget)}
	>
		{#if linkedLabel}Choose{:else}
			<hx-strong title={present ? option.label : undefined}>{option.label}</hx-strong>
			{@render badge(option.recommended)}
		{/if}
		{#if !present && !linkedEffect && option.effect}
			<hx-span class="hh-choice-effect">{option.effect}</hx-span>
		{/if}
	</hx-button>
{/snippet}

{#snippet otherDialog()}
	<OtherAnswerModal
		question={agent.question ?? ''}
		maxlength={2000}
		{busy}
		onsend={onother}
		onclose={closeDetail}
	/>
{/snippet}

{#snippet confirmDialog()}
	<Modal isOpen title="Confirm answer" variant="text" onClose={closeDetail}>
		{@render confirmation()}
	</Modal>
{/snippet}

{#snippet confirmation()}
	{#if pendingChoice && agent.confirm}
		<hx-div
			class="hh-choice-confirm"
			role="group"
			aria-label={`Confirm this ${agent.confirm} answer`}
		>
			<hx-p>
				This is a <hx-strong>{agent.confirm}</hx-strong> decision. Answer
				<hx-strong><LinkifiedText text={pendingChoice.option.label} /></hx-strong>?
			</hx-p>
			{#if present && pendingChoice.option.effect}<hx-p
					><LinkifiedText text={pendingChoice.option.effect} /></hx-p
				>{/if}
			<hx-div class="hh-quick-replies">
				<hx-button type="button" class="po-action hh-primary" disabled={busy} onclick={confirm}
					>Confirm answer</hx-button
				>
				<hx-button type="button" class="po-action" onclick={closeDetail}>Cancel</hx-button>
			</hx-div>
		</hx-div>
	{/if}
{/snippet}
