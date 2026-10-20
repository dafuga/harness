<script lang="ts">
	import type { Checkpoint, GameView, GameDocument } from '../../../game/src/models/Game.types';
	import type { DesktopBridge } from '../models/DesktopBridge.types';
	import GameCheckpointEditor from './GameCheckpointEditor.svelte';
	import GameCheckpointImage from './GameCheckpointImage.svelte';
	let {
		context,
		readonly = false,
		change
	}: {
		context: {
			checkpoint: Checkpoint;
			view: GameView;
			document: GameDocument;
			projectId?: string | null;
			revision?: string;
			commit?: string;
			bridge?: DesktopBridge;
		};
		readonly?: boolean;
		change: (node: Checkpoint) => void;
	} = $props();
</script>

<div class="pane">
	<GameCheckpointEditor checkpoint={context.checkpoint} {readonly} {change} />
	<GameCheckpointImage
		checkpoint={context.checkpoint}
		view={context.view}
		document={context.document}
		projectId={context.projectId}
		revision={context.revision}
		commit={context.commit}
		bridge={context.bridge}
		{readonly}
		change={(patch) => change({ ...context.checkpoint, ...patch })}
	/>
</div>

<style>
	.pane {
		display: grid;
		gap: 24px;
		min-width: 0;
	}
</style>
