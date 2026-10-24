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
	function focusFirst(field: HTMLElement, enabled: boolean) {
		if (enabled) requestAnimationFrame(() => field.focus());
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
					placeholder="What happens here, and what should the player see?"
					oninput={(e) => update({ description: e.currentTarget.value })}
					use:focusFirst={adding}
				></hx-textarea>
			</hx-label>
			<hx-label class="name">
				<hx-span>Title</hx-span>
				<hx-input
					aria-label="Checkpoint title"
					value={node.title}
					{readonly}
					oninput={(e) => update({ title: e.currentTarget.value })}
				/>
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
</style>
