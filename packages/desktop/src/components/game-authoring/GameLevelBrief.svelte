<!-- @harness-tier organism -->
<!-- @harness-atoms ../../../../reports/src/components/shared-primitives/atoms -->
<script lang="ts">
	import Select from '$shared/Select.svelte';
	import AgentModelPicker from '../agents-providers/AgentModelPicker.svelte';
	import type { Dimension } from '../../../../game/src/models/game-authoring/Game.types';
	import type { GameLevelBriefProps as Props } from './GameLevelBrief.types';
	/**
	 * The concept on its own, then the level brief, its dimension and the local model that will
	 * propose it. Generate sends what is shown; the result waits for review, unsaved and unapproved.
	 */
	let {
		step,
		planning,
		dimension,
		providers,
		provider = $bindable(),
		model = $bindable(),
		status,
		reviewable = false,
		revise,
		reshape,
		generate,
		go
	}: Props = $props();
	const chosen = $derived.by(() => {
		const from = providers?.find((item) => item.id === provider);
		const named = from?.models.find((item) => item.id === model)?.label;
		return from && named ? from.label + ' · ' + named : 'No model chosen';
	});
	const note = $derived.by(() => {
		if (status.busy) return 'Generating a proposal. This can take a minute.';
		return status.reason || 'A local model proposes a level for you to review. Nothing is saved.';
	});
</script>

<hx-div class="brief" data-harness-component="game-level-brief">
	{#if step === 'concept'}
		<hx-label class="field">
			<hx-span>Concept</hx-span>
			<hx-textarea
				rows="3"
				value={planning.concept}
				readonly={status.readonly}
				placeholder="The idea of this level, in a sentence or two"
				oninput={(event) => revise({ concept: event.currentTarget.value })}
			></hx-textarea>
		</hx-label>
		<hx-div class="actions">
			<hx-button
				type="button"
				class="primary"
				disabled={!planning.concept.trim()}
				onclick={() => go('brief')}>Continue to level brief</hx-button
			>
		</hx-div>
	{:else}
		<hx-p class="concept">
			<hx-small>Concept</hx-small>
			<hx-span>{planning.concept}</hx-span>
			{#if !status.readonly}
				<hx-button type="button" class="quiet" onclick={() => go('concept')}>Edit concept</hx-button
				>
			{/if}
		</hx-p>
		<hx-label class="field">
			<hx-span>Level brief</hx-span>
			<hx-textarea
				rows="4"
				value={planning.description}
				readonly={status.readonly}
				placeholder="Layout, objectives and obstacles"
				oninput={(event) => revise({ description: event.currentTarget.value })}
			></hx-textarea>
		</hx-label>
		<hx-div class="options">
			<hx-span class="option">
				<hx-small aria-hidden="true">Dimension</hx-small>
				<Select
					label="Level dimension"
					bind:value={() => dimension, (next) => reshape(next as Dimension)}
					disabled={status.readonly}
				>
					<hx-option value="2d">2D</hx-option>
					<hx-option value="3d">3D</hx-option>
				</Select>
			</hx-span>
			{#if providers?.length && !status.readonly}
				<hx-span class="option">
					<hx-small aria-hidden="true">Model</hx-small>
					<hx-span class="model"
						><AgentModelPicker {providers} bind:provider bind:model />{chosen}</hx-span
					>
				</hx-span>
			{/if}
		</hx-div>
		<hx-div class="actions">
			{#if reviewable}
				<hx-button type="button" onclick={() => go('review')}>Back to review</hx-button>
			{/if}
			{#if !status.readonly}
				<hx-button
					type="button"
					class="primary"
					disabled={status.busy || Boolean(status.reason)}
					onclick={() => generate()}>Generate level</hx-button
				>
			{/if}
		</hx-div>
		<hx-p class="note" role="status">{note}</hx-p>
		{#if status.error}<hx-p class="error" role="alert">{status.error}</hx-p>{/if}
	{/if}
</hx-div>

<style>
	.brief,
	.field,
	.option {
		display: grid;
		gap: var(--hx-space-16);
		min-width: 0;
	}
	.field,
	.option {
		gap: var(--hx-space-6);
	}
	.field > span {
		font-size: var(--hx-type-size-sm);
		font-weight: var(--hx-style-weight-semibold);
	}
	p {
		margin: 0;
	}
	.concept,
	.options,
	.model,
	.actions {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--hx-space-8);
	}
	.options {
		align-items: end;
		gap: var(--hx-space-16);
	}
	.concept > span {
		min-width: 0;
		overflow-wrap: anywhere;
	}
	.actions {
		justify-content: flex-end;
	}
	small,
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
		border-color: transparent;
		background: none;
		color: var(--hx-color-text-muted);
	}
	.quiet:hover {
		color: var(--hx-color-primary);
	}
</style>
