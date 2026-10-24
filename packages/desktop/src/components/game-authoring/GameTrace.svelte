<!-- @harness-tier molecule -->
<!-- @harness-atoms ../../../../reports/src/components/shared-primitives/atoms -->
<script lang="ts">
	import type { GameRun, GameView } from '../../../../game/src/models/game-authoring/Game.types';
	let { run, view }: { run: GameRun; view: GameView } = $props();
	/** Views may share checkpoint ids, so only this view's entries are counted and titled here. */
	const entries = $derived(run.trace.filter((entry) => (entry.viewId ?? view.id) === view.id));
</script>

<hx-details data-harness-component="game-trace">
	<hx-summary>Execution trace ({entries.length})</hx-summary>
	{#if entries.length}
		<hx-ol aria-label="Checkpoint execution trace">
			{#each entries as entry, index (index)}
				<hx-li>
					<hx-strong
						>{view.checkpoints.find((node) => node.id === entry.checkpointId)?.title ??
							entry.checkpointId}</hx-strong
					>
					· tick {entry.tick} — {entry.reason}
				</hx-li>
			{/each}
		</hx-ol>
	{:else}<hx-p>No checkpoints have fired in this preview.</hx-p>{/if}
</hx-details>
