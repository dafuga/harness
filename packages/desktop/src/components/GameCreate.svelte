<script lang="ts">
	import { resolve } from '$app/paths';
	import Select from '$shared/Select.svelte';
	import { onMount } from 'svelte';
	import type { ProjectSnapshot } from '../models/Desktop.types';
	import type { DesktopBridge } from '../models/DesktopBridge.types';
	import type { EnvironmentHost } from '../models/Environment.types';
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
		gap: 14px 12px;
		width: min(100%, 440px);
		margin: 8px auto 28px;
		padding: 20px;
		text-align: start;
		background: radial-gradient(ellipse at top, #0a2636, var(--panel) 70%);
		border: 1px solid var(--line);
		border-radius: 12px;
		box-shadow: 0 18px 40px #00101b99;
		transition: border-color 0.15s;
	}
	.game-create:focus-within {
		border-color: color-mix(in srgb, var(--gold) 40%, var(--line));
	}
	.wide {
		grid-column: 1 / -1;
	}
	.intro h2 {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 16px;
	}
	.intro h2::before {
		content: '';
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: var(--gold);
	}
	.intro small {
		margin-top: 4px;
	}
	.field {
		display: grid;
		gap: 6px;
		min-width: 0;
	}
	.caption {
		color: var(--muted);
		font-size: 11px;
		font-weight: 600;
		letter-spacing: 0.06em;
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
		outline: 2px solid var(--gold);
		outline-offset: 2px;
	}
	/* Above the gate's own spacing of its primary button. */
	.game-create .primary {
		margin: 4px 0 0;
		min-height: 44px;
	}
	.game-create .error {
		margin: 0;
		border-radius: 8px;
		font-size: 13px;
	}
	@media (max-width: 480px) {
		.game-create {
			grid-template-columns: minmax(0, 1fr);
		}
	}
</style>
