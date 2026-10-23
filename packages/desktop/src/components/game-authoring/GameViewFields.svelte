<script lang="ts">
	import Select from '$shared/Select.svelte';
	import { LevelValidator } from '../../../../game/src/index';
	import type { GameView } from '../../../../game/src/models/game-authoring/Game.types';
	import type { GameSection, GameViewFieldsProps as Props } from './GameViewFields.types';
	/**
	 * The view picker in a compact toolbar, with the game sections beside it. The view's title,
	 * dimension, art direction and New level wait behind View settings; closed, they stay in the
	 * page, hidden, so their values are still the document's.
	 */
	let {
		view,
		views,
		readonly = false,
		section = $bindable(),
		select,
		create,
		change
	}: Props = $props();
	const sections: GameSection[] = ['Level', 'Preview', 'Checkpoints', 'Mechanics'];
	let expanded = $state(false);
	/** Level is for a planned view; its play and checkpoints wait until the level is built. */
	const shown = $derived(sections.filter((name) => name !== 'Level' || view.planning));
	const ready = $derived(LevelValidator.isReady(view));
	const gated = (name: GameSection) => !ready && (name === 'Preview' || name === 'Checkpoints');
	/** Another dimension withdraws a planned level's approval and build; its brief and work stay. */
	function reshape(dimension: string) {
		const next = dimension as GameView['dimension'];
		const planning = view.planning && { ...view.planning, approved: undefined, built: undefined };
		change(planning ? { dimension: next, planning } : { dimension: next });
	}
	/** A new level opens on its plan, in the current view's dimension and art direction. */
	function createLevel() {
		const { dimension, style } = view;
		const id = 'view-' + Date.now().toString(36);
		const planning = { concept: '', description: '' };
		create({ id, title: 'New level', dimension, style, checkpoints: [], planning });
		select(id);
		section = 'Level';
		expanded = false;
	}
	const retitle = (event: Event) =>
		change({ title: (event.currentTarget as HTMLInputElement).value });
	const restyle = (event: Event) =>
		change({ style: (event.currentTarget as HTMLTextAreaElement).value });
</script>

<div class="fields" data-harness-component="game-view-fields">
	<div class="toolbar">
		<Select label="View" bind:value={() => view.id, select}>
			{#each views as item (item.id)}
				<option value={item.id}>{item.title}</option>
			{/each}
		</Select>
		<div class="sections" role="group" aria-label="Game sections">
			{#each shown as name (name)}
				<button
					type="button"
					class:gold={section === name}
					aria-pressed={section === name}
					disabled={gated(name)}
					onclick={() => (section = name)}>{name}</button
				>
			{/each}
		</div>
		<button
			type="button"
			class="toggle"
			aria-expanded={expanded}
			aria-controls="game-view-settings"
			onclick={() => (expanded = !expanded)}
		>
			View settings <span aria-hidden="true">{expanded ? '▴' : '▾'}</span>
		</button>
	</div>
	<div id="game-view-settings" class="settings" hidden={!expanded}>
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
		{#if !readonly}<button type="button" class="new" onclick={createLevel}>New level</button>{/if}
	</div>
</div>

<style>
	.fields {
		display: grid;
		gap: var(--hx-space-16);
		min-width: 0;
	}
	.toolbar,
	.sections {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--hx-space-12);
	}
	.sections {
		gap: var(--hx-space-6);
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
		gap: var(--hx-space-12) var(--hx-space-16);
		padding: var(--hx-space-16);
		border: var(--hx-border-thin) solid var(--line);
		border-radius: var(--hx-radius);
		background: var(--panel);
	}
	.settings[hidden] {
		display: none;
	}
	.field {
		display: grid;
		gap: var(--hx-space-6);
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
