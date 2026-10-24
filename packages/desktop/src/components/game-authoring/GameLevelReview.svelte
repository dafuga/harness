<!-- @harness-tier organism -->
<!-- @harness-atoms ../../../../reports/src/components/shared-primitives/atoms -->
<script lang="ts">
	import GameLevelPreview from './GameLevelPreview.svelte';
	import type { GameLevelReviewProps as Props } from './GameLevelReview.types';
	/**
	 * A generated proposal as data: its geometry drawn, its summary and the model that made it.
	 * Approving and building are separate clicks, and nothing here plays the level.
	 */
	let {
		proposal,
		providers,
		approved = false,
		built = false,
		status,
		regenerate,
		approve,
		build,
		edit
	}: Props = $props();
	let feedback = $state('');
	const layout = $derived(proposal.layout);
	const source = $derived.by(() => {
		const from = providers?.find((item) => item.id === proposal.provider);
		const named = from?.models.find((item) => item.id === proposal.model)?.label;
		return (from?.label ?? proposal.provider) + ' · ' + (named ?? proposal.model);
	});
	const note = $derived.by(() => {
		if (status.busy) return 'Generating a new proposal. This can take a minute.';
		if (approved) return 'Approved. Build the level to unlock its checkpoints.';
		return status.reason || 'Approve this proposal to build it, or ask for changes.';
	});
</script>

<hx-div class="review" data-harness-component="game-level-review">
	<GameLevelPreview {layout} dimension={proposal.dimension} label="Level preview" />
	<hx-div class="details">
		<hx-p class="summary">{proposal.summary}</hx-p>
		<hx-p class="meta">
			<hx-span class="chip">{proposal.dimension.toUpperCase()}</hx-span>
			<hx-span class="chip">{source}</hx-span>
		</hx-p>
		<hx-details>
			<hx-summary
				>{layout.objects.length} objects on a {layout.width} × {layout.depth} floor</hx-summary
			>
			<hx-ul>
				{#each layout.objects as item (item.id)}
					<hx-li>{item.label} <hx-small>{item.kind}</hx-small></hx-li>
				{/each}
			</hx-ul>
		</hx-details>
		{#if built}
			<hx-p class="note">Built. Preview and Checkpoints are open for this level.</hx-p>
		{:else if !status.readonly}
			<hx-label class="field">
				<hx-span>Requested changes</hx-span>
				<hx-textarea
					rows="2"
					bind:value={feedback}
					disabled={status.busy}
					placeholder="Optional: what should change?"
				></hx-textarea>
			</hx-label>
		{/if}
		{#if !status.readonly}
			<hx-div class="actions">
				<hx-button type="button" class="quiet" onclick={edit}>Edit brief</hx-button>
				{#if !built}
					<hx-button
						type="button"
						disabled={status.busy || Boolean(status.reason)}
						onclick={() => regenerate(feedback)}>Regenerate</hx-button
					>
					<hx-button type="button" disabled={approved || status.busy} onclick={approve}
						>Approve level</hx-button
					>
					<hx-button
						type="button"
						class="primary"
						disabled={!approved || status.busy}
						onclick={build}>Build level</hx-button
					>
				{/if}
			</hx-div>
		{/if}
		{#if !built}<hx-p class="note" role="status">{note}</hx-p>{/if}
		{#if status.error}<hx-p class="error" role="alert">{status.error}</hx-p>{/if}
	</hx-div>
</hx-div>

<style>
	.review {
		display: grid;
		grid-template-columns: minmax(0, 3fr) minmax(0, 2fr);
		align-items: start;
		gap: var(--hx-space-16);
	}
	.details,
	.field {
		display: grid;
		gap: var(--hx-space-12);
		min-width: 0;
	}
	.field {
		gap: var(--hx-space-6);
	}
	.field > span {
		font-size: var(--hx-type-size-sm);
		font-weight: var(--hx-style-weight-semibold);
	}
	p {
		margin: 0;
	}
	.summary {
		line-height: var(--hx-style-leading-normal);
	}
	.meta,
	.actions {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--hx-space-8);
	}
	ul {
		margin: var(--hx-space-8) 0 0;
		padding-inline-start: var(--hx-space-18);
	}
	small,
	summary,
	.note {
		color: var(--hx-color-text-muted);
	}
	.note {
		font-size: var(--hx-type-size-xs);
		line-height: var(--hx-style-leading-normal);
	}
	textarea {
		resize: vertical;
	}
	textarea:focus-visible {
		outline: var(--hx-border-thick) solid var(--hx-color-primary);
	}
	.quiet {
		margin-inline-end: auto;
		border-color: transparent;
		background: none;
		color: var(--hx-color-text-muted);
	}
	.quiet:hover {
		color: var(--hx-color-primary);
	}
	@media (max-width: 1100px) {
		.review {
			grid-template-columns: minmax(0, 1fr);
		}
	}
</style>
