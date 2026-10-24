<script lang="ts">
	import { onDestroy } from 'svelte';
	import Modal from '$shared/Modal.svelte';
	import type {
		Checkpoint,
		GameView,
		GameDocument
	} from '../../../../game/src/models/game-authoring/Game.types';
	import type { DesktopBridge } from '../../models/development-tooling/DesktopBridge.types';
	import GameCheckpointEditor from './GameCheckpointEditor.svelte';
	import GameCheckpointImage from './GameCheckpointImage.svelte';
	/** One checkpoint description and image review, with optional advanced rules. */
	let {
		context,
		adding = false,
		readonly = false,
		change,
		close,
		remove
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
		adding?: boolean;
		readonly?: boolean;
		change: (node: Checkpoint) => void;
		close: () => void;
		remove: () => void;
	} = $props();
	let advanced = $state(false);
	const node = $derived(context.checkpoint);
	const title = $derived(adding ? 'Add checkpoint' : readonly ? 'Checkpoint' : 'Edit checkpoint');
	const opener = typeof document === 'undefined' ? null : document.activeElement;
	onDestroy(() => {
		const back =
			typeof HTMLElement !== 'undefined' && opener instanceof HTMLElement ? opener : null;
		if (back) requestAnimationFrame(() => back.isConnected && back.focus());
	});
	const update = (patch: Partial<Checkpoint>) => change({ ...context.checkpoint, ...patch });
	function adopt(patch: Partial<Checkpoint>) {
		update(patch);
		close();
	}
	function focusFirst(field: HTMLElement, enabled: boolean) {
		if (enabled) requestAnimationFrame(() => field.focus());
	}
</script>

<div class="checkpoint-modal">
	<Modal open {title} variant="text" onClose={close}>
		<div class="fields" data-harness-component="game-checkpoint-pane">
			<label>
				<span>Describe your checkpoint</span>
				<textarea
					value={node.description}
					{readonly}
					placeholder="What happens here, and what should the player see?"
					oninput={(e) => update({ description: e.currentTarget.value })}
					use:focusFirst={adding}
				></textarea>
			</label>
			<label class="name">
				<span>Title</span>
				<input
					aria-label="Checkpoint title"
					value={node.title}
					{readonly}
					oninput={(e) => update({ title: e.currentTarget.value })}
				/>
			</label>
			<GameCheckpointImage
				checkpoint={node}
				view={context.view}
				document={context.document}
				projectId={context.projectId}
				revision={context.revision}
				commit={context.commit}
				bridge={context.bridge}
				{readonly}
				change={update}
				accept={adopt}
			/>
			<button
				type="button"
				class="disclosure"
				aria-expanded={advanced}
				aria-controls="checkpoint-rules"
				onclick={() => (advanced = !advanced)}
			>
				<span aria-hidden="true">{advanced ? '▾' : '▸'}</span> Advanced rules
			</button>
			<div id="checkpoint-rules" class="rules" hidden={!advanced}>
				<GameCheckpointEditor checkpoint={node} {readonly} {change} />
			</div>
		</div>
		{#snippet footer()}
			{#if !readonly}
				<button type="button" class="quiet" onclick={remove}>Delete checkpoint</button>
			{/if}
			<button type="button" class="done" onclick={close}>Done</button>
		{/snippet}
	</Modal>
</div>

<style>
	/* The shared modal brings no frame of its own here; this one is framed through its own wrapper. */
	.checkpoint-modal {
		display: contents;
	}
	.checkpoint-modal :global(.viewer-dialog[open]) {
		display: flex;
		flex-direction: column;
		width: min(640px, calc(100vw - 24px));
		max-width: calc(100vw - 24px);
		max-height: calc(100dvh - 24px);
		padding: 0;
		border: var(--hx-border-thin) solid var(--hx-color-border);
		border-radius: var(--hx-radius-xlarge);
		background: var(--hx-color-surface);
		color: inherit;
		box-shadow: var(--hx-shadow-dialog);
		overflow: hidden;
	}
	.checkpoint-modal :global(.viewer-dialog::backdrop) {
		background: var(--hx-color-scrim);
	}
	.checkpoint-modal :global(.viewer-header),
	.checkpoint-modal :global(footer) {
		display: flex;
		align-items: center;
		gap: var(--hx-space-8);
		padding: var(--hx-space-10) var(--hx-space-12) var(--hx-space-10) var(--hx-space-20);
	}
	.checkpoint-modal :global(.viewer-header) {
		justify-content: space-between;
		border-bottom: var(--hx-border-thin) solid var(--hx-color-border);
	}
	.checkpoint-modal :global(.viewer-header button) {
		display: grid;
		place-items: center;
		width: 40px;
		height: 40px;
		padding: 0;
		border-color: transparent;
		background: none;
	}
	.checkpoint-modal :global(.viewer-content) {
		flex: 1;
		min-height: 0;
		overflow: auto;
		overscroll-behavior: contain;
		padding: var(--hx-space-20);
	}
	.checkpoint-modal :global(footer) {
		border-top: var(--hx-border-thin) solid var(--hx-color-border);
	}
	.fields,
	label {
		display: grid;
		gap: var(--hx-space-16);
	}
	label {
		gap: var(--hx-space-6);
	}
	label > span {
		font-size: var(--hx-type-size-sm);
		font-weight: var(--hx-style-weight-semibold);
	}
	textarea {
		min-height: 96px;
		resize: vertical;
	}
	input:focus-visible,
	textarea:focus-visible {
		outline: var(--hx-border-thick) solid var(--hx-color-primary);
	}
	.name {
		grid-template-columns: auto minmax(0, 1fr);
		align-items: center;
		gap: var(--hx-space-12);
	}
	.name > span {
		color: var(--hx-color-text-muted);
		font-weight: var(--hx-style-weight-regular);
	}
	.name input {
		padding-block: var(--hx-space-6);
		background: none;
	}
	.disclosure,
	.quiet {
		justify-self: start;
		border-color: transparent;
		background: none;
		color: var(--hx-color-text-muted);
	}
	.disclosure {
		padding-inline: 0;
	}
	.disclosure:hover,
	.disclosure[aria-expanded='true'],
	.quiet:hover {
		color: var(--hx-color-primary);
	}
	.rules {
		padding-top: var(--hx-space-16);
		border-top: var(--hx-border-thin) solid var(--hx-color-border);
	}
	.done {
		margin-inline-start: auto;
	}
</style>
