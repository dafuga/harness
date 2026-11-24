<!-- @harness-tier organism -->
<!-- @harness-atoms ../../../../../reports/src/components/shared-primitives/atoms -->
<!-- @harness-uid u_akmdzyosmw -->
<script lang="ts">
	import type {
		InboxWriteView,
		TrackerInboxSource
	} from '../../../models/development-tooling/TrackerInbox.types';

	let {
		source,
		writes,
		onchanged
	}: {
		source: TrackerInboxSource;
		writes: InboxWriteView[];
		onchanged: () => Promise<void>;
	} = $props();

	const stateLabels = {
		pending: 'Pending',
		acknowledged: 'Acknowledged',
		conflict: 'Conflict',
		rejected: 'Rejected'
	} as const;

	let discarding = $state<string | null>(null);
	let busy = $state(false);

	async function discard(intentId: string) {
		if (busy) return;
		busy = true;
		try {
			await source.discard(intentId);
			discarding = null;
			await onchanged();
		} finally {
			busy = false;
		}
	}
</script>

<hx-section class="writes" aria-label="Write states">
	<hx-h2>Your writes</hx-h2>
	{#if writes.length === 0}
		<hx-p class="meta">Nothing is waiting to sync.</hx-p>
	{:else}
		<hx-ul class="plain">
			{#each writes as write (write.intentId)}
				<hx-li class="write" data-state={write.state}>
					<hx-span class="state">{stateLabels[write.state]}</hx-span>
					<hx-span>{write.label}</hx-span>
					{#if write.discardable}
						{#if discarding === write.intentId}
							<hx-div class="buttons">
								<hx-span class="meta">Discard it? It will not reach the Tracker.</hx-span>
								<hx-button type="button" disabled={busy} onclick={() => discard(write.intentId)}>
									Confirm discard
								</hx-button>
								<hx-button type="button" class="quiet" onclick={() => (discarding = null)}>
									Keep it
								</hx-button>
							</hx-div>
						{:else}
							<hx-button type="button" class="quiet" onclick={() => (discarding = write.intentId)}>
								Review and discard
							</hx-button>
						{/if}
					{/if}
				</hx-li>
			{/each}
		</hx-ul>
	{/if}
</hx-section>

<style>
	:global(.writes) {
		display: grid;
		gap: var(--hx-space-8);
	}
	:global(.writes h2) {
		margin: 0;
		font-size: var(--hx-type-size-sm);
	}
	:global(.plain) {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: var(--hx-space-8);
	}
	:global(.write) {
		display: grid;
		gap: var(--hx-space-4);
	}
	:global(.state) {
		font-weight: var(--hx-style-weight-semibold);
		margin-right: var(--hx-space-6);
	}
	:global(.meta) {
		color: var(--hx-color-text-muted);
		font-size: var(--hx-type-size-xs);
		margin: 0;
	}
	:global(.buttons) {
		display: flex;
		flex-wrap: wrap;
		gap: var(--hx-space-6);
		align-items: center;
	}
	:global(.writes button) {
		font: inherit;
		padding: var(--hx-space-6) var(--hx-space-10);
		border-radius: var(--hx-radius-small);
		border: var(--hx-border-thin) solid var(--hx-color-primary);
		background: transparent;
		color: var(--hx-color-text);
		justify-self: start;
	}
	:global(.writes button.quiet) {
		border-color: var(--hx-color-border);
	}
</style>
