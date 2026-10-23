<script lang="ts">
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

<div data-harness-component="game-controls">
	<div class="row">
		<span class="chip">x {fixed(run.state.x)} · y {fixed(run.state.y)}</span>
		{#if !world}
			<span class="chip">{run.state.hasKey ? 'Key held' : 'No key yet'}</span>
			<span class="chip">{run.state.doorOpen ? 'Door open' : 'Door locked'}</span>
		{/if}
		{#if run.state.outcome}<span class="chip gold">Reached the {run.state.outcome}</span>{/if}
	</div>
	<div class="row">
		{#each buttons as move (move.name)}
			<button aria-label={move.name} onclick={() => step({ x: move.x, y: move.y })}>
				{move.text}
			</button>
		{/each}
		{#if !world}
			{#each ['Garden', 'Vault'] as branch (branch)}
				<button disabled={!run.state.doorOpen} onclick={() => choose(branch)}>{branch}</button>
			{/each}
		{/if}
		<button onclick={reset}>Reset</button>
		<small>Or hold the arrow keys.</small>
	</div>
</div>

<style>
	.row {
		flex-wrap: wrap;
		margin-top: var(--hx-space-14);
	}
</style>
