<!-- @harness-tier organism -->
<!-- @harness-atoms ../../../../reports/src/components/shared-primitives/atoms -->
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
	/** Focus the first field once the pane is drawn, unless the author has already chosen another field to type in. */
	function focusFirst(field: HTMLElement, enabled: boolean) {
		if (!enabled) return;
		requestAnimationFrame(() => {
			const chosen = document.activeElement;
			if (
				chosen &&
				chosen !== field &&
				chosen.matches('input, textarea, select, [contenteditable]')
			)
				return;
			field.focus();
		});
	}
</script>

<hx-div class="checkpoint-modal">
	<Modal open {title} variant="text" onClose={close}>
		<hx-div class="fields" data-harness-component="game-checkpoint-pane">
			<hx-label>
				<hx-span>Describe your checkpoint</hx-span>
				<hx-textarea
					value={node.description}
					{readonly}
					disabled={readonly}
					placeholder="What happens here, and what should the player see?"
					oninput={(e) => update({ description: e.currentTarget.value })}
					use:focusFirst={adding}
				></hx-textarea>
			</hx-label>
			<hx-label class="name">
				<hx-span>Title</hx-span>
				<hx-textarea
					aria-label="Checkpoint title"
					rows="1"
					value={node.title}
					{readonly}
					disabled={readonly}
					oninput={(e) => update({ title: e.currentTarget.value })}
				></hx-textarea>
			</hx-label>
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
			<hx-button
				type="button"
				class="disclosure"
				aria-expanded={advanced}
				aria-controls="checkpoint-rules"
				onclick={() => (advanced = !advanced)}
			>
				<hx-span aria-hidden="true">{advanced ? '▾' : '▸'}</hx-span> Advanced rules
			</hx-button>
			<hx-div id="checkpoint-rules" class="rules" hidden={!advanced}>
				<GameCheckpointEditor checkpoint={node} {readonly} {change} />
			</hx-div>
		</hx-div>
		{#snippet footer()}
			{#if !readonly}
				<hx-button type="button" class="quiet" onclick={remove}>Delete checkpoint</hx-button>
			{/if}
			<hx-button type="button" class="done" onclick={close}>Done</hx-button>
		{/snippet}
	</Modal>
</hx-div>

<style>
	@import './game-checkpoint-pane/gameCheckpointPane.css';
	textarea:disabled {
		opacity: var(--hx-opacity-dim);
		cursor: not-allowed;
	}
	textarea:disabled {
		resize: none;
	}
</style>
