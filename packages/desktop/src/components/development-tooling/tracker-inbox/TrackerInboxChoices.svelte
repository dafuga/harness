<!-- @harness-tier organism -->
<!-- @harness-atoms ../../../../../reports/src/components/shared-primitives/atoms -->
<!-- @harness-uid u_ch01c3s0ak -->
<!-- @harness-uid u_dq2f5r7w3h -->
<script lang="ts">
	import type { InboxFlag } from '../../../models/development-tooling/TrackerInbox.types';
	import OtherAnswerModal from '$reports/components/explorer-ui/explorer-kit/OtherAnswerModal.svelte';
	import {
		flagQuestion,
		orderedOptions
	} from '../../../lib/development-tooling/tracker-inbox/trackerInbox';

	let {
		flag,
		busy = false,
		compact = false,
		onpick,
		onother
	}: {
		flag: InboxFlag;
		busy?: boolean;
		/** Keep the overview tiles to labels and badges. Item detail shows the effects. */
		compact?: boolean;
		/** Called with the option's 1-based number once any confirm step is done. */
		onpick: (number: number) => void;
		/** Called with the answer written in the Other modal. */
		onother: (text: string) => void;
	} = $props();
	let writing = $state(false);

	const choices = $derived(orderedOptions(flag));
	let pending = $state<number | null>(null);
	const pendingChoice = $derived(choices.find((entry) => entry.number === pending) ?? null);

	function tap(number: number) {
		// Deploy, money and secret asks stop at a confirm step; other asks are answered by the tap.
		if (flag.confirm) pending = number;
		else onpick(number);
	}

	function confirm() {
		if (pending === null) return;
		const number = pending;
		pending = null;
		onpick(number);
	}
</script>

{#if flag.state === 'open'}
	<hx-section class="choices" aria-label="Choose an answer">
		<hx-ul class="plain" class:compact>
			{#each choices as { number, option } (number)}
				<hx-li>
					<hx-button
						type="button"
						class="choice"
						data-recommended={option.recommended ? 'true' : undefined}
						disabled={busy}
						onclick={() => tap(number)}
					>
						<hx-strong title={compact ? option.label : undefined}>{option.label}</hx-strong>
						{#if option.recommended}<hx-span class="badge">Recommended</hx-span>{/if}
						{#if !compact && option.effect}<hx-span class="effect">{option.effect}</hx-span>{/if}
					</hx-button>
				</hx-li>
			{/each}
			<hx-li>
				<hx-button
					type="button"
					class="choice"
					aria-haspopup="dialog"
					disabled={busy}
					onclick={() => (writing = true)}
				>
					<hx-strong>Other…</hx-strong>
					{#if !compact}<hx-span class="effect">Write a different answer.</hx-span>{/if}
				</hx-button>
			</hx-li>
		</hx-ul>
		{#if writing}
			<OtherAnswerModal
				question={flagQuestion(flag)}
				maxlength={512}
				{busy}
				onsend={onother}
				onclose={() => (writing = false)}
			/>
		{/if}
		{#if pendingChoice && flag.confirm}
			<hx-div class="confirm" role="group" aria-label="Confirm this {flag.confirm} answer">
				<hx-p>
					This is a <hx-strong>{flag.confirm}</hx-strong> decision. Answer
					<hx-strong>{pendingChoice.option.label}</hx-strong>?
				</hx-p>
				{#if pendingChoice.option.effect}
					<hx-p class="meta">{pendingChoice.option.effect}</hx-p>
				{/if}
				<hx-div class="buttons">
					<hx-button type="button" disabled={busy} onclick={confirm}>Confirm answer</hx-button>
					<hx-button type="button" class="quiet" onclick={() => (pending = null)}>
						Cancel
					</hx-button>
				</hx-div>
			</hx-div>
		{/if}
	</hx-section>
{/if}
