<script lang="ts">
	import { onDestroy } from 'svelte';
	import type { Checkpoint, GameView, GameDocument } from '../../../../game/src/index';
	import type { DesktopBridge } from '../../models/development-tooling/DesktopBridge.types';
	let {
		checkpoint,
		view,
		document,
		projectId,
		revision,
		commit,
		readonly = false,
		bridge,
		change
	}: {
		checkpoint: Checkpoint;
		view: GameView;
		document: GameDocument;
		projectId?: string | null;
		revision?: string;
		commit?: string;
		readonly?: boolean;
		bridge?: DesktopBridge;
		change: (patch: Partial<Checkpoint>) => void;
	} = $props();
	let preview = $state(''),
		busy = $state(false),
		error = $state(''),
		note = $state('');
	let generation = 0,
		reading = 0;
	const ready = $derived(
		Boolean(!readonly && !commit && projectId && revision && bridge?.gameImageGenerate)
	);
	function identity() {
		return JSON.stringify([
			projectId,
			view.id,
			view.style,
			view.dimension,
			checkpoint.id,
			checkpoint.title,
			checkpoint.description,
			checkpoint.imagePrompt,
			checkpoint.requires,
			checkpoint.conditions,
			checkpoint.actions
		]);
	}
	/** Every edit replaces the pane's context: reading depends on these values, not on the edit. */
	const owner = $derived(projectId + ':' + view.id + ':' + checkpoint.id),
		path = $derived(checkpoint.image?.path),
		project = $derived(projectId),
		at = $derived(commit),
		reader = $derived(bridge?.gameImageRead);
	$effect(() => {
		void owner;
		generation++;
		busy = false;
		error = note = '';
	});
	$effect(() => {
		const source = ++reading;
		preview = error = '';
		if (path && project && reader)
			void reader({ projectId: project, path, ...(at ? { commit: at } : {}) })
				.then((url) => {
					if (source === reading) preview = url;
				})
				.catch(() => {
					if (source === reading) error = 'Unable to read this checkpoint image.';
				});
		return () => {
			reading++;
		};
	});
	// The read effect's own teardown already ends reading; only a pending generation needs ending.
	onDestroy(() => void generation++);
	async function generate() {
		if (!ready || busy || !projectId || !revision || !bridge?.gameImageGenerate) return;
		const source = ++generation,
			stamp = identity();
		busy = true;
		error = note = '';
		try {
			const result = await bridge.gameImageGenerate({
				projectId,
				document,
				viewId: view.id,
				checkpointId: checkpoint.id,
				expectedRevision: revision
			});
			if (source !== generation || readonly || commit) return;
			change({ image: result.image });
			preview = result.dataUrl;
			if (stamp !== identity())
				note = 'Made from earlier guidance. Regenerate to match your edits.';
		} catch (cause) {
			if (source === generation)
				error = cause instanceof Error ? cause.message : 'Image generation failed.';
		} finally {
			if (source === generation) busy = false;
		}
	}
</script>

<section
	class="image-panel"
	data-harness-component="game-checkpoint-image"
	aria-label="Checkpoint image"
	aria-busy={busy}
>
	<header>
		<h3>Gameplay checkpoint image</h3>
		<small>GPT Image 2</small>
	</header>
	{#if preview}<figure>
			<img src={preview} alt={checkpoint.title + ' gameplay reference'} />
			<figcaption>
				{checkpoint.image?.model} · {checkpoint.image?.createdAt.slice(0, 10)}
			</figcaption>
		</figure>{/if}
	<label
		><span>Checkpoint image direction</span><textarea
			aria-label="Checkpoint image direction"
			value={checkpoint.imagePrompt ?? ''}
			disabled={readonly || Boolean(commit)}
			oninput={(e) => change({ imagePrompt: e.currentTarget.value })}
			placeholder="Describe the intended look at this checkpoint."
		></textarea></label
	>
	<p class="hint">
		One paid image per click · medium quality · landscape. Uses the view style and checkpoint
		guidance.
	</p>
	{#if !projectId}<p class="hint">Open a local game project to generate images.</p>{/if}
	{#if commit || readonly}<p class="hint">
			Saved images are available here; generation requires an editable game.
		</p>{/if}
	<div class="row">
		<button class="primary" disabled={!ready || busy} onclick={generate}
			>{busy
				? 'Generating image…'
				: checkpoint.image
					? 'Regenerate checkpoint image'
					: 'Generate checkpoint image'}</button
		>
		{#if checkpoint.image}<button
				disabled={readonly || Boolean(commit) || busy}
				onclick={() => change({ image: undefined })}>Remove image reference</button
			>{/if}
	</div>
	{#if error}<p role="alert" class="error">{error}</p>{/if}
	{#if note && checkpoint.image}<p class="hint" role="status">{note}</p>{/if}
	<p class="hint">
		Save the graph to keep this reference. Images guide appearance; mechanics stay in the engine.
	</p>
</section>

<style>
	.image-panel {
		display: grid;
		gap: 16px;
		border-top: 1px solid var(--border);
		padding-top: 20px;
		min-width: 0;
	}
	header {
		display: flex;
		justify-content: space-between;
		gap: 12px;
		align-items: baseline;
	}
	h3 {
		margin: 0;
		font-size: 14px;
	}
	small,
	.hint,
	figcaption {
		color: var(--muted);
		font-size: 12px;
	}
	label {
		display: grid;
		gap: 8px;
	}
	label > span {
		color: var(--muted);
		font-size: 12px;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}
	textarea {
		min-height: 96px;
		resize: vertical;
	}
	figure {
		margin: 0;
		display: grid;
		gap: 8px;
	}
	img {
		width: 100%;
		display: block;
		border-radius: 8px;
		border: 1px solid var(--border);
	}
	.hint {
		margin: 0;
		line-height: 1.5;
	}
	.row {
		flex-wrap: wrap;
	}
	button {
		white-space: normal;
	}
</style>
