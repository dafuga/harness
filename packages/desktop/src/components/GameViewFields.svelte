<script lang="ts">
	import Select from '$shared/Select.svelte';
	import type { GameView } from '../../../game/src/models/Game.types';
	let {
		view,
		views,
		readonly = false,
		select,
		create,
		change
	}: {
		view: GameView;
		views: GameView[];
		readonly?: boolean;
		select: (id: string) => void;
		create: () => void;
		change: (patch: Partial<GameView>) => void;
	} = $props();
	const reshape = (dimension: string) => change({ dimension: dimension as GameView['dimension'] });
	const retitle = (event: Event) =>
		change({ title: (event.currentTarget as HTMLInputElement).value });
	const restyle = (event: Event) =>
		change({ style: (event.currentTarget as HTMLTextAreaElement).value });
</script>

<div class="row">
	<Select label="View" bind:value={() => view.id, select}>
		{#each views as item (item.id)}
			<option value={item.id}>{item.title}</option>
		{/each}
	</Select>
	<input aria-label="View title" value={view.title} {readonly} oninput={retitle} />
	<Select label="Dimension" bind:value={() => view.dimension, reshape} disabled={readonly}>
		<option value="2d">2D</option>
		<option value="3d">3D</option>
	</Select>
	{#if !readonly}<button onclick={create}>New view</button>{/if}
</div>
<label class="field">
	<small>Style for AI video</small>
	<textarea rows="2" value={view.style} {readonly} oninput={restyle}></textarea>
</label>

<style>
	.row {
		flex-wrap: wrap;
	}
	.field {
		display: grid;
		gap: 6px;
	}
</style>
