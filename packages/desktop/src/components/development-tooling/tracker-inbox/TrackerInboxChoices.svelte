<!-- @harness-tier organism -->
<!-- @harness-atoms ../../../../../reports/src/components/shared-primitives/atoms -->
<!-- @harness-uid u_ch01c3s0ak -->
<script lang="ts">
	import type { InboxFlag } from '../../../models/development-tooling/TrackerInbox.types';
	import { orderedOptions } from '../../../lib/development-tooling/tracker-inbox/trackerInbox';

	let {
		flag,
		busy = false,
		onpick
	}: {
		flag: InboxFlag;
		busy?: boolean;
		/** Called with the option's 1-based number once any confirm step is done. */
		onpick: (number: number) => void;
	} = $props();

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

{#if choices.length >= 2}
	<hx-section class="choices" aria-label="Choose an answer">
		<hx-ul class="plain">
			{#each choices as { number, option } (number)}
				<hx-li>
					<hx-button
						type="button"
						class="choice"
						data-recommended={option.recommended ? 'true' : undefined}
						disabled={busy}
						onclick={() => tap(number)}
					>
						<hx-strong>{option.label}</hx-strong>
						{#if option.recommended}<hx-span class="badge">Recommended</hx-span>{/if}
						{#if option.effect}<hx-span class="effect">{option.effect}</hx-span>{/if}
					</hx-button>
				</hx-li>
			{/each}
		</hx-ul>
		<hx-p class="meta">Or write your own answer with Answer flag.</hx-p>
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
