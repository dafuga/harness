<script lang="ts">
	import type { GameRun, GameView } from '../../../game/src/models/Game.types';
	let { run, view }: { run: GameRun; view: GameView } = $props();
	/** Views may share checkpoint ids, so only this view's entries are counted and titled here. */
	const entries = $derived(run.trace.filter((entry) => (entry.viewId ?? view.id) === view.id));
</script>

<details data-harness-component="game-trace">
	<summary>Execution trace ({entries.length})</summary>
	{#if entries.length}
		<ol aria-label="Checkpoint execution trace">
			{#each entries as entry, index (index)}
				<li>
					<strong
						>{view.checkpoints.find((node) => node.id === entry.checkpointId)?.title ??
							entry.checkpointId}</strong
					>
					· tick {entry.tick} — {entry.reason}
				</li>
			{/each}
		</ol>
	{:else}<p>No checkpoints have fired in this preview.</p>{/if}
</details>
