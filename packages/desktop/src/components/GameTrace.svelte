<script lang="ts">
	import type { GameRun, GameView } from '../../../game/src/models/Game.types';
	let { run, view }: { run: GameRun; view: GameView } = $props();
</script>

<details data-harness-component="game-trace">
	<summary>Execution trace ({run.trace.length})</summary>
	{#if run.trace.length}
		<ol aria-label="Checkpoint execution trace">
			{#each run.trace as entry, index (index)}
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
