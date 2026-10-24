<script lang="ts">
	import type { Candidate } from './GameCheckpointImage.types';
	import type {
		Checkpoint,
		CheckpointImage,
		GameView,
		GameDocument
	} from '../../../../game/src/index';
	import type { DesktopBridge } from '../../models/development-tooling/DesktopBridge.types';
	/**
	 * A generated image stays a candidate, apart from the confirmed image, until Use this image.
	 * Closing or a failure leaves the confirmed image as it was; nothing generates without a click.
	 */
	let {
		checkpoint,
		view,
		document,
		projectId,
		revision,
		commit,
		readonly = false,
		bridge,
		change,
		accept
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
		accept: (patch: Partial<Checkpoint>) => void;
	} = $props();
	let preview = $state(''),
		candidate = $state.raw<Candidate | null>(null),
		changes = $state(''),
		busy = $state(false),
		error = $state('');
	let generation = 0,
		reading = 0;
	const reason = $derived(blocked()),
		idle = $derived(!busy && !reason);
	function blocked() {
		if (commit) return 'History is read-only, so new images are off here.';
		if (readonly) return 'This game is read-only, so new images are off.';
		if (!projectId) return 'The demo is not saved, so it cannot generate images.';
		if (!revision) return 'Reload the game to generate images.';
		if (!bridge?.gameImageGenerate) return 'This app cannot generate images.';
		return checkpoint.description.trim() ? '' : 'Describe the checkpoint to generate its image.';
	}
	/** What an image is made from, to tell a result that predates later edits. */
	function identity() {
		const { style, dimension } = view;
		const { title, description, requires, conditions, actions } = checkpoint;
		return JSON.stringify({ style, dimension, title, description, requires, conditions, actions });
	}
	/** The document as it stands, with this checkpoint carrying the guidance for one image. */
	function draft(guidance: string): GameDocument {
		const swap = (c: Checkpoint) => (c.id === checkpoint.id ? { ...c, imagePrompt: guidance } : c);
		const views = document.views.map((v) =>
			v.id === view.id ? { ...v, checkpoints: v.checkpoints.map(swap) } : v
		);
		return { ...document, views };
	}
	/** Every edit replaces the context: reading and results depend on these values, not on edits. */
	const owner = $derived([projectId, revision, commit, view.id, checkpoint.id].join(':')),
		path = $derived(checkpoint.image?.path),
		project = $derived(projectId),
		at = $derived(commit),
		reader = $derived(bridge?.gameImageRead);
	/** A pending result ends with its owner, and when the editor closes. */
	$effect(() => {
		void owner;
		busy = false;
		candidate = null;
		error = changes = '';
		return () => void generation++;
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
		return () => void reading++;
	});
	/** Each image keeps the guidance before it, so requested changes add to the original intent. */
	async function generate(request = '') {
		if (!idle || !projectId || !revision || !bridge?.gameImageGenerate) return;
		const base = candidate ? candidate.guidance : (checkpoint.imagePrompt ?? '');
		const guidance = [base, request.trim()].filter(Boolean).join('\n');
		const source = ++generation,
			stamp = identity();
		busy = true;
		error = '';
		try {
			const result = await bridge.gameImageGenerate({
				projectId,
				document: draft(guidance),
				viewId: view.id,
				checkpointId: checkpoint.id,
				expectedRevision: revision
			});
			if (source !== generation) return;
			const stale = stamp !== identity();
			candidate = { image: result.image, url: result.dataUrl, guidance, stale };
			changes = '';
		} catch (cause) {
			if (source === generation)
				error = cause instanceof Error ? cause.message : 'Image generation failed.';
		} finally {
			if (source === generation) busy = false;
		}
	}
	const choose = ({ image, guidance }: Candidate) =>
		accept(guidance ? { image, imagePrompt: guidance } : { image });
</script>

<section
	class="image-panel"
	data-harness-component="game-checkpoint-image"
	aria-label="Checkpoint image"
	aria-busy={busy}
>
	{#if candidate}
		<figure>
			<img src={candidate.url} alt={'New checkpoint image for ' + checkpoint.title} />
			<figcaption class="muted">
				Not used yet.{candidate.stale ? ' Made before your latest edits.' : ''}
			</figcaption>
		</figure>
		<label>
			<span>Request changes</span>
			<textarea bind:value={changes} disabled={busy} placeholder="Warmer light, lanterns…"
			></textarea>
		</label>
		<div class="actions">
			<button disabled={!idle || !changes.trim()} onclick={() => generate(changes)}
				>Generate changes</button
			>
			<button class="primary" disabled={busy} onclick={() => choose(candidate!)}
				>Use this image</button
			>
		</div>
	{:else}
		{#if preview}
			<figure>
				<img src={preview} alt={checkpoint.title + ' gameplay reference'} />
				<figcaption class="muted">
					Current image · {checkpoint.image?.createdAt.slice(0, 10)}
				</figcaption>
			</figure>
		{/if}
		<div class="actions">
			{#if checkpoint.image && !readonly && !commit}
				<button class="muted" disabled={busy} onclick={() => change({ image: undefined })}
					>Remove image reference</button
				>
			{/if}
			<button class="primary" disabled={!idle} onclick={() => generate()}>Generate image</button>
		</div>
	{/if}
	<p class="muted" role="status">
		{busy
			? 'Generating an image. This can take a minute.'
			: reason || 'Each image is one paid GPT Image request.'}
	</p>
	{#if error}<p role="alert" class="error">{error}</p>{/if}
</section>

<style>
	.image-panel,
	figure,
	label {
		display: grid;
		gap: var(--hx-space-10);
		min-width: 0;
		margin: 0;
	}
	img {
		width: 100%;
		max-height: min(420px, 45dvh);
		object-fit: contain;
		border: var(--hx-border-thin) solid var(--hx-color-border);
		border-radius: var(--hx-radius);
		background: var(--hx-color-background);
	}
	label > span {
		font-size: var(--hx-type-size-sm);
		font-weight: var(--hx-style-weight-semibold);
	}
	textarea {
		min-height: 64px;
		resize: vertical;
	}
	textarea:focus-visible {
		outline: var(--hx-border-thick) solid var(--hx-color-primary);
	}
	.actions {
		display: flex;
		flex-wrap: wrap;
		justify-content: flex-end;
		gap: var(--hx-space-8);
	}
	p,
	figcaption {
		margin: 0;
		font-size: var(--hx-type-size-xs);
		line-height: var(--hx-style-leading-normal);
	}
</style>
