<script lang="ts">
	import { resolve } from '$app/paths';
	import Select from '$shared/Select.svelte';
	import { onMount } from 'svelte';
	import type { ProjectSnapshot } from '../../models/development-tooling/Desktop.types';
	import type { DesktopBridge } from '../../models/development-tooling/DesktopBridge.types';
	import type { EnvironmentHost } from '../../models/development-tooling/Environment.types';
	/** Without a `bridge` the preload's is used; one without `gameCreate` creates nothing. */
	let {
		bridge,
		created
	}: { bridge?: DesktopBridge; created?: (snapshot: ProjectSnapshot) => void } = $props();
	let host = $state.raw<DesktopBridge>();
	let name = $state('');
	let kind = $state('app');
	let dimension = $state('2d');
	let busy = $state(false);
	let error = $state('');
	const active = $derived(bridge ?? host);
	const ready = $derived(typeof active?.gameCreate === 'function');
	const game = $derived(kind === 'game');
	const locked = $derived(!ready || busy);
	onMount(() => {
		host = (window as unknown as EnvironmentHost).harness;
	});
	/** A game opens on its own views; an app on the workspace, which shows the backend's selection. */
	function destination(snapshot: ProjectSnapshot, made: 'app' | 'game') {
		if (made === 'app') return '/harness';
		const id = snapshot.project.id;
		if (!id) throw new Error('The new game came back without a project id.');
		return `/game?projectId=${encodeURIComponent(id)}`;
	}
	async function submit(event: SubmitEvent) {
		event.preventDefault();
		const title = name.trim();
		if (!active?.gameCreate || !title || busy) return;
		busy = true;
		error = '';
		const made = game ? ('game' as const) : ('app' as const);
		// An app has no dimension of its own; the bridge still asks for one.
		const shape = game && dimension === '3d' ? ('3d' as const) : ('2d' as const);
		try {
			const snapshot = await active.gameCreate({ name: title, kind: made, dimension: shape });
			if (!created) {
				// A full load: the page reads the project the backend now holds as selected.
				window.location.assign(resolve(destination(snapshot, made) as '/'));
				return;
			}
			created(snapshot);
		} catch (cause) {
			error = cause instanceof Error ? cause.message : String(cause);
		}
		busy = false;
	}
</script>

{#if ready}
	<form
		class="game-create"
		data-harness-component="game-create"
		aria-label="New project"
		aria-busy={busy}
		onsubmit={submit}
	>
		<div class="intro wide">
			<h2>New project</h2>
			<small
				>{ready
					? 'An app or a game, created and opened on this device.'
					: 'This desktop app cannot create projects yet.'}</small
			>
		</div>
		<label class="field wide">
			<span class="caption">Name</span>
			<input bind:value={name} name="name" required autocomplete="off" disabled={locked} />
		</label>
		<label class="field" class:wide={!game}>
			<span class="caption">Project type</span>
			<Select bind:value={kind} label="Project type" name="kind" disabled={locked}>
				<option value="app">App</option>
				<option value="game">Game</option>
			</Select>
		</label>
		{#if game}<label class="field">
				<span class="caption">Dimension</span>
				<Select bind:value={dimension} label="Dimension" name="dimension" disabled={locked}>
					<option value="2d">2D</option>
					<option value="3d">3D</option>
				</Select>
			</label>{/if}
		<button class="primary wide" type="submit" disabled={locked || !name.trim()}
			>{busy ? 'Creating…' : 'Create project'}</button
		>
		{#if error}<p class="error wide" role="alert">{error}</p>{/if}
	</form>
{/if}

<style>
	.game-create {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: var(--hx-space-14) var(--hx-space-12);
		width: min(100%, 440px);
		margin: var(--hx-space-8) auto var(--hx-space-28);
		padding: var(--hx-space-20);
		text-align: start;
		background: radial-gradient(
			ellipse at top,
			var(--hx-color-surface-raised),
			var(--hx-color-surface) 70%
		);
		border: var(--hx-border-thin) solid var(--hx-color-border);
		border-radius: var(--hx-radius-large);
		box-shadow: var(--hx-shadow-overlay);
		transition: border-color var(--hx-motion-fast);
	}
	.game-create:focus-within {
		border-color: color-mix(in srgb, var(--hx-color-primary) 40%, var(--hx-color-border));
	}
	.wide {
		grid-column: 1 / -1;
	}
	.intro h2 {
		display: flex;
		align-items: center;
		gap: var(--hx-space-8);
		font-size: var(--hx-type-size-base);
	}
	.intro h2::before {
		content: '';
		width: 6px;
		height: 6px;
		border-radius: var(--hx-radius-round);
		background: var(--hx-color-primary);
	}
	.intro small {
		margin-top: var(--hx-space-4);
	}
	.field {
		display: grid;
		gap: var(--hx-space-6);
		min-width: 0;
	}
	.caption {
		color: var(--hx-color-text-muted);
		font-size: var(--hx-type-size-2xs);
		font-weight: var(--hx-style-weight-semibold);
		letter-spacing: var(--hx-style-tracking-wide);
		text-transform: uppercase;
	}
	.field input,
	.field :global(.report-select) {
		display: block;
		width: 100%;
	}
	.field input {
		min-height: 44px;
	}
	.field input:focus-visible,
	.field :global(select:focus-visible) {
		outline: var(--hx-border-thick) solid var(--hx-color-primary);
		outline-offset: var(--hx-border-thick);
	}
	/* Above the gate's own spacing of its primary button. */
	.game-create .primary {
		margin: var(--hx-space-4) 0 0;
		min-height: 44px;
	}
	.game-create .error {
		margin: 0;
		border-radius: var(--hx-radius-small);
		font-size: var(--hx-type-size-compact);
	}
	@media (max-width: 480px) {
		.game-create {
			grid-template-columns: minmax(0, 1fr);
		}
	}
</style>
