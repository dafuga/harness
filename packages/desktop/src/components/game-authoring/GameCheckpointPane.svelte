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
		border: 1px solid var(--line);
		border-radius: 14px;
		background: var(--panel);
		color: inherit;
		box-shadow: 0 24px 80px #0009;
		overflow: hidden;
	}
	.checkpoint-modal :global(.viewer-dialog::backdrop) {
		background: rgb(3 26 40 / 0.72);
	}
	.checkpoint-modal :global(.viewer-header),
	.checkpoint-modal :global(footer) {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 10px 12px 10px 20px;
	}
	.checkpoint-modal :global(.viewer-header) {
		justify-content: space-between;
		border-bottom: 1px solid var(--line);
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
		padding: 20px;
	}
	.checkpoint-modal :global(footer) {
		border-top: 1px solid var(--line);
	}
	.fields,
	label {
		display: grid;
		gap: 16px;
	}
	label {
		gap: 6px;
	}
	label > span {
		font-size: 14px;
		font-weight: 600;
	}
	textarea {
		min-height: 96px;
		resize: vertical;
	}
	input:focus-visible,
	textarea:focus-visible {
		outline: 2px solid var(--gold);
	}
	.name {
		grid-template-columns: auto minmax(0, 1fr);
		align-items: center;
		gap: 12px;
	}
	.name > span {
		color: var(--muted);
		font-weight: 400;
	}
	.name input {
		padding-block: 6px;
		background: none;
	}
	.disclosure,
	.quiet {
		justify-self: start;
		border-color: transparent;
		background: none;
		color: var(--muted);
	}
	.disclosure {
		padding-inline: 0;
	}
	.disclosure:hover,
	.disclosure[aria-expanded='true'],
	.quiet:hover {
		color: var(--gold);
	}
	.rules {
		padding-top: 16px;
		border-top: 1px solid var(--line);
	}
	.done {
		margin-inline-start: auto;
	}
</style>
