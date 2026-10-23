<script lang="ts">
	import type { Snippet } from 'svelte';
	import Select from '$shared/Select.svelte';
	import type { GameView } from '../../../../game/src/models/game-authoring/Game.types';
	/**
	 * The view picker in a compact toolbar, with the parent's game sections beside it. The view's
	 * title, dimension, art direction and New view wait behind View settings; closed, they stay in
	 * the page, hidden, so their values are still the document's.
	 */
	let {
		view,
		views,
		readonly = false,
		select,
		create,
		change,
		children
	}: {
		view: GameView;
		views: GameView[];
		readonly?: boolean;
		select: (id: string) => void;
		create: () => void;
		change: (patch: Partial<GameView>) => void;
		children?: Snippet;
	} = $props();
	let open = $state(false);
	const reshape = (dimension: string) => change({ dimension: dimension as GameView['dimension'] });
	const retitle = (event: Event) =>
		change({ title: (event.currentTarget as HTMLInputElement).value });
	const restyle = (event: Event) =>
		change({ style: (event.currentTarget as HTMLTextAreaElement).value });
</script>

<div class="toolbar">
	<Select label="View" bind:value={() => view.id, select}>
		{#each views as item (item.id)}
			<option value={item.id}>{item.title}</option>
		{/each}
	</Select>
	{#if children}
		<div class="sections" role="group" aria-label="Game sections">{@render children()}</div>
	{/if}
	<button
		type="button"
		class="toggle"
		aria-expanded={open}
		aria-controls="game-view-settings"
		onclick={() => (open = !open)}
	>
		View settings <span aria-hidden="true">{open ? '▴' : '▾'}</span>
	</button>
</div>
<div id="game-view-settings" class="settings" hidden={!open}>
	<label class="field">
		<small>View title</small>
		<input value={view.title} {readonly} oninput={retitle} />
	</label>
	<div class="field">
		<small aria-hidden="true">Dimension</small>
		<Select label="Dimension" bind:value={() => view.dimension, reshape} disabled={readonly}>
			<option value="2d">2D</option>
			<option value="3d">3D</option>
		</Select>
	</div>
	<label class="field style">
		<small>Art direction</small>
		<textarea rows="2" value={view.style} {readonly} oninput={restyle}></textarea>
	</label>
	{#if !readonly}<button type="button" class="new" onclick={create}>New view</button>{/if}
</div>

<style>
	.toolbar,
	.sections {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 12px;
	}
	.sections {
		gap: 6px;
	}
	.toggle {
		margin-inline-start: auto;
		color: var(--muted);
	}
	.toggle:hover,
	.toggle[aria-expanded='true'] {
		border-color: var(--gold);
		color: var(--gold);
	}
	.settings {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		align-items: end;
		gap: 12px 16px;
		padding: 16px;
		border: 1px solid var(--line);
		border-radius: 10px;
		background: var(--panel);
	}
	.settings[hidden] {
		display: none;
	}
	.field {
		display: grid;
		gap: 6px;
		min-width: 0;
	}
	.style {
		grid-column: 1 / -1;
	}
	.new {
		justify-self: start;
	}
	@media (max-width: 560px) {
		.settings {
			grid-template-columns: minmax(0, 1fr);
		}
	}
</style>
