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

<div class="review" data-harness-component="game-level-review">
	<GameLevelPreview {layout} dimension={proposal.dimension} label="Level preview" />
	<div class="details">
		<p class="summary">{proposal.summary}</p>
		<p class="meta">
			<span class="chip">{proposal.dimension.toUpperCase()}</span>
			<span class="chip">{source}</span>
		</p>
		<details>
			<summary>{layout.objects.length} objects on a {layout.width} × {layout.depth} floor</summary>
			<ul>
				{#each layout.objects as item (item.id)}
					<li>{item.label} <small>{item.kind}</small></li>
				{/each}
			</ul>
		</details>
		{#if built}
			<p class="note">Built. Preview and Checkpoints are open for this level.</p>
		{:else if !status.readonly}
			<label class="field">
				<span>Requested changes</span>
				<textarea
					rows="2"
					bind:value={feedback}
					disabled={status.busy}
					placeholder="Optional: what should change?"
				></textarea>
			</label>
		{/if}
		{#if !status.readonly}
			<div class="actions">
				<button type="button" class="quiet" onclick={edit}>Edit brief</button>
				{#if !built}
					<button
						type="button"
						disabled={status.busy || Boolean(status.reason)}
						onclick={() => regenerate(feedback)}>Regenerate</button
					>
					<button type="button" disabled={approved || status.busy} onclick={approve}
						>Approve level</button
					>
					<button type="button" class="primary" disabled={!approved || status.busy} onclick={build}
						>Build level</button
					>
				{/if}
			</div>
		{/if}
		{#if !built}<p class="note" role="status">{note}</p>{/if}
		{#if status.error}<p class="error" role="alert">{status.error}</p>{/if}
	</div>
</div>

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
		color: var(--muted);
	}
	.note {
		font-size: var(--hx-type-size-xs);
		line-height: var(--hx-style-leading-normal);
	}
	textarea {
		resize: vertical;
	}
	textarea:focus-visible {
		outline: var(--hx-border-thick) solid var(--gold);
	}
	.quiet {
		margin-inline-end: auto;
		border-color: transparent;
		background: none;
		color: var(--muted);
	}
	.quiet:hover {
		color: var(--gold);
	}
	@media (max-width: 1100px) {
		.review {
			grid-template-columns: minmax(0, 1fr);
		}
	}
</style>
