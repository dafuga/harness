<!-- @harness-tier organism -->
<!-- @harness-atoms ../../../../reports/src/components/shared-primitives/atoms -->
<script lang="ts">
	import Pill from '$shared/explorer-ui/explorer-kit/Pill.svelte';
	import type { GameControlsProps as Props } from './GameControls.types';
	/**
	 * The player's position and movement. A built level moves in four directions from its spawn;
	 * a view without a level keeps the starter's key, door and branch choices.
	 */
	let { view, run, step, reset }: Props = $props();
	const world = $derived(Boolean(view.world));
	/** Up and down cross the level's depth: up lowers y and down raises it. */
	const moves = [
		{ name: 'Move up', text: '↑ Move up', x: 0, y: -1 },
		{ name: 'Move down', text: '↓ Move down', x: 0, y: 1 },
		{ name: 'Move left', text: '← Move left', x: -1, y: 0 },
		{ name: 'Move right', text: 'Move right →', x: 1, y: 0 }
	];
	const buttons = $derived(world ? moves : moves.slice(2));
	const fixed = (value: unknown) => Number(value).toFixed(2);
	const choose = (branch: string) => step({ x: 0, y: 0, choice: branch.toLowerCase() });
</script>

<hx-div data-harness-component="game-controls">
	<hx-div class="row">
		<Pill as="span" variant="chip" tone="game-controls-chip"
			>x {fixed(run.state.x)} · y {fixed(run.state.y)}</Pill
		>
		{#if !world}
			<Pill as="span" variant="chip" tone="game-controls-chip"
				>{run.state.hasKey ? 'Key held' : 'No key yet'}</Pill
			>
			<Pill as="span" variant="chip" tone="game-controls-chip"
				>{run.state.doorOpen ? 'Door open' : 'Door locked'}</Pill
			>
		{/if}
		{#if run.state.outcome}<Pill as="span" variant="chip" tone="gold game-controls-chip"
				>Reached the {run.state.outcome}</Pill
			>{/if}
	</hx-div>
	<hx-div class="row">
		{#each buttons as move (move.name)}
			<hx-button aria-label={move.name} onclick={() => step({ x: move.x, y: move.y })}>
				{move.text}
			</hx-button>
		{/each}
		{#if !world}
			{#each ['Garden', 'Vault'] as branch (branch)}
				<hx-button disabled={!run.state.doorOpen} onclick={() => choose(branch)}>{branch}</hx-button
				>
			{/each}
		{/if}
		<hx-button onclick={reset}>Reset</hx-button>
		<hx-small>Or hold the arrow keys.</hx-small>
	</hx-div>
</hx-div>

<style>
	.row {
		flex-wrap: wrap;
		margin-top: var(--hx-space-14);
	}
</style>
