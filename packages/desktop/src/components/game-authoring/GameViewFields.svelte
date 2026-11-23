<!-- @harness-tier organism -->
<!-- @harness-atoms ../../../../reports/src/components/shared-primitives/atoms -->
<!-- @harness-uid u_dhurrtwh3i -->
<script lang="ts">
	import Select from '$shared/Select.svelte';
	import Modal from '$shared/Modal.svelte';
	import { LevelValidator } from '../../../../game/src/index';
	import type { GameView } from '../../../../game/src/models/game-authoring/Game.types';
	import type { GameSection, GameViewFieldsProps as Props } from './GameViewFields.types';
	/**
	 * One action row: the view picker, the game sections, New view and a settings icon. The view's
	 * title, dimension and art direction wait in the View settings dialog, so no form sits inline.
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
	let settingsOpen = $state(false);
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
	/** A new view opens on its plan, in the current view's dimension and art direction. */
	function createLevel() {
		const { dimension, style } = view;
		const id = 'view-' + Date.now().toString(36);
		const planning = { concept: '', description: '' };
		create({ id, title: 'New level', dimension, style, checkpoints: [], planning });
		select(id);
		section = 'Level';
	}
	const retitle = (event: Event) =>
		change({ title: (event.currentTarget as HTMLInputElement).value });
	const restyle = (event: Event) =>
		change({ style: (event.currentTarget as HTMLTextAreaElement).value });
</script>

<hx-div class="fields" data-harness-component="game-view-fields">
	<hx-div class="toolbar">
		<Select label="View" expanded={views.length > 1} bind:value={() => view.id, select}>
			{#each views as item (item.id)}
				<hx-option value={item.id}>{item.title}</hx-option>
			{/each}
		</Select>
		<hx-div class="sections" role="group" aria-label="Game sections">
			{#each shown as name (name)}
				<hx-button
					type="button"
					class:gold={section === name}
					aria-pressed={section === name}
					disabled={gated(name)}
					onclick={() => (section = name)}>{name}</hx-button
				>
			{/each}
		</hx-div>
		{#if !readonly}<hx-button type="button" class="new" onclick={createLevel}>New view</hx-button
			>{/if}
		<hx-button
			type="button"
			class="icon"
			aria-label="View settings"
			aria-haspopup="dialog"
			onclick={() => (settingsOpen = true)}><hx-span aria-hidden="true">⚙</hx-span></hx-button
		>
	</hx-div>
	<Modal
		title="View settings"
		variant="text"
		open={settingsOpen}
		onClose={() => (settingsOpen = false)}
	>
		<hx-div class="settings" data-harness-component="game-view-settings">
			{#if readonly}<hx-small class="readonly-note">Read-only view settings</hx-small>{/if}
			<hx-label class="field">
				<hx-small>View title</hx-small>
				<hx-input value={view.title} {readonly} disabled={readonly} oninput={retitle} />
			</hx-label>
			<hx-div class="field">
				<hx-small aria-hidden="true">Dimension</hx-small>
				<Select label="Dimension" bind:value={() => view.dimension, reshape} disabled={readonly}>
					<hx-option value="2d">2D</hx-option>
					<hx-option value="3d">3D</hx-option>
				</Select>
			</hx-div>
			<hx-label class="field style">
				<hx-small>Art direction</hx-small>
				<hx-textarea rows="4" value={view.style} {readonly} disabled={readonly} oninput={restyle}
				></hx-textarea>
			</hx-label>
		</hx-div>
	</Modal>
</hx-div>

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
	.icon {
		min-width: 44px;
		min-height: 44px;
	}
	.settings {
		display: grid;
		gap: var(--hx-space-12) var(--hx-space-16);
		min-width: 0;
	}
	.readonly-note {
		grid-column: 1 / -1;
	}
	input:disabled,
	textarea:disabled {
		opacity: var(--hx-opacity-dim);
		cursor: not-allowed;
	}
	textarea:disabled {
		resize: none;
	}
	.field {
		display: grid;
		gap: var(--hx-space-6);
		min-width: 0;
	}
	.style {
		grid-column: 1 / -1;
	}
</style>
