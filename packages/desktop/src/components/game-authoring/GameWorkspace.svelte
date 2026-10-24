<!-- @harness-tier organism -->
<!-- @harness-atoms ../../../../reports/src/components/shared-primitives/atoms -->
<script lang="ts">
	import type { Source } from './GameWorkspace.types';
	import { resolve } from '$app/paths';
	import { untrack } from 'svelte';
	import GameNavigationGuard from './GameNavigationGuard.svelte';
	import type { GameWorkspaceProps as Props } from '../../models/game-authoring/GameWorkspace.types';
	import GameViewFields from './GameViewFields.svelte';
	import type { GameSection } from './GameViewFields.types';
	import GameLevelPlan from './GameLevelPlan.svelte';
	import { createRun, enterView, LevelValidator } from '../../../../game/src/index';
	import { exampleDocument, validateDocument } from '../../../../game/src/index';
	import type { Checkpoint, GameDocument, GameRun, GameView } from '../../../../game/src/index';
	import GameCheckpointPane from './GameCheckpointPane.svelte';
	import GameGraph from './GameGraph.svelte';
	import GameMechanics from './GameMechanics.svelte';
	import GamePreview from './game-preview/GamePreview.svelte';
	import GameTrace from './GameTrace.svelte';
	let { projectId = null, commit, readonly = false, bridge }: Props = $props();
	let doc = $state.raw<GameDocument>();
	let revision = $state<string>();
	let viewId = $state('');
	let tab = $state<GameSection>('Checkpoints');
	let run = $state.raw<GameRun>(createRun());
	let selected = $state<string | null>(null); // The checkpoint open in the editor, if any.
	/** A new checkpoint and the state before Add, restored if it is closed untouched or deleted. */
	let added = $state.raw<{ node: Checkpoint; before: GameDocument; dirty: boolean } | null>(null);
	let dirty = $state(false);
	let busy = $state(false);
	let conflict = $state(false);
	let error = $state('');
	let request = 0;
	const demo = $derived(!projectId || !bridge?.gameRead);
	const editable = $derived(!readonly && !commit && (demo || Boolean(bridge?.gameSave)));
	const locked = $derived(!editable);
	const problems = $derived(doc ? validateDocument(doc) : []);
	const savable = $derived(editable && dirty && !busy && !problems.length);
	const view = $derived(doc?.views.find((item) => item.id === viewId) ?? doc?.views[0]);
	const checkpoint = $derived(view?.checkpoints.find((item) => item.id === selected));
	const text = (cause: unknown) => (cause instanceof Error ? cause.message : String(cause));
	/** A planned level shows its plan until it is built; Mechanics stays open throughout. */
	const section = $derived.by<GameSection>(() => {
		if (!view?.planning) return tab === 'Level' ? 'Checkpoints' : tab;
		return tab === 'Mechanics' || (tab !== 'Level' && LevelValidator.isReady(view)) ? tab : 'Level';
	});
	function track(next: GameRun) {
		const target = String(next.state.view ?? '');
		const changed = next.tick > run.tick && target !== run.state.view;
		run = next;
		if (changed && doc?.views.some((item) => item.id === target)) viewId = target;
	}
	$effect(() => {
		const id = view?.id;
		if (id && run.viewId !== id) untrack(() => (run = enterView(run, id)));
	});
	async function load({ projectId, commit, bridge }: Source) {
		const id = ++request;
		[error, conflict] = ['', false];
		busy = Boolean(projectId && bridge?.gameRead);
		if (!projectId || !bridge?.gameRead) return open(exampleDocument('2d'));
		try {
			const result = await bridge.gameRead({ projectId, ...(commit ? { commit } : {}) });
			if (id === request) open(result.document, result.revision);
		} catch (cause) {
			if (id === request) error = text(cause);
		} finally {
			if (id === request) busy = false;
		}
	}
	function open(next: GameDocument, at?: string) {
		doc = next;
		run = createRun();
		revision = at;
		dirty = false;
		selected = added = null;
		if (!next.views.some((item) => item.id === viewId)) viewId = next.views[0]?.id ?? '';
	}
	async function save() {
		const sent = doc;
		if (!savable || !sent || !revision || !projectId || !bridge?.gameSave) return;
		const input = { projectId, document: sent, expectedRevision: revision };
		busy = true;
		error = '';
		try {
			revision = (await bridge.gameSave(input)).revision;
			dirty = doc !== sent;
		} catch (cause) {
			error = text(cause);
			conflict = /revision|conflict|stale|changed/i.test(error);
		} finally {
			busy = false;
		}
	}
	function edit(next: GameDocument) {
		if (!editable) return;
		doc = next;
		dirty = true;
	}
	function editView(patch: Partial<GameView>) {
		const current = view;
		if (!doc || !current) return;
		const views = doc.views.map((item) => (item.id === current.id ? { ...item, ...patch } : item));
		edit({ ...doc, views });
	}
	function editCheckpoint(node: Checkpoint) {
		if (!view || !editable) return;
		const nodes = view.checkpoints.map((item) => (item.id === selected ? node : item));
		editView({ checkpoints: nodes });
		selected = node.id;
	}
	function addCheckpoint(node: Checkpoint) {
		if (!doc || !view || !editable) return;
		added = { node, before: doc, dirty };
		editView({ checkpoints: [...view.checkpoints, node] });
		selected = node.id;
	}
	function closeCheckpoint(discard = false) {
		if (added && (discard || JSON.stringify(checkpoint) === JSON.stringify(added.node)))
			[doc, dirty] = [added.before, added.dirty];
		selected = added = null;
	}
	function removeCheckpoint() {
		const id = selected;
		if (added || !view || !id) return closeCheckpoint(true);
		const rest = view.checkpoints.filter((c) => c.id !== id);
		const unlinked = rest.map((c) => ({ ...c, requires: c.requires.filter((r) => r !== id) }));
		closeCheckpoint();
		editView({ checkpoints: unlinked });
	}
	function editMechanics(list: GameDocument['mechanics']) {
		if (doc) edit({ ...doc, mechanics: list });
	}
	$effect(() => {
		const source = { projectId, commit, bridge };
		untrack(() => void load(source));
	});
</script>

<GameNavigationGuard active={!demo && editable && dirty} />
<hx-section class="game" data-harness-component="game-workspace">
	<hx-a class="back" href={resolve('/harness')}
		><hx-span aria-hidden="true">←</hx-span> Back to project</hx-a
	>
	<hx-header class="row" style="flex-wrap:wrap">
		<hx-h1 style="flex:1;margin:0">Game Views</hx-h1>
		{#if demo}<hx-span class="chip gold">Demo</hx-span>{/if}
		{#if commit}<hx-span class="chip">History · {commit.slice(0, 8)}</hx-span>{/if}
		{#if readonly && !commit}<hx-span class="chip">Read-only</hx-span>{/if}
		{#if dirty}<hx-span class="chip gold">Unsaved changes</hx-span>{/if}
		{#if !demo && editable}
			<hx-button class="primary" disabled={!savable} onclick={save}>Save</hx-button>
		{/if}
	</hx-header>
	{#if demo}<hx-p class="muted">Demo: an in-memory example. Nothing here is saved.</hx-p>{/if}
	{#if conflict}
		<hx-p class="error" role="alert">
			This game was saved elsewhere since it was opened. Your edits are still here.
			<hx-button onclick={() => load({ projectId, commit, bridge })}
				>Discard edits and reload</hx-button
			>
		</hx-p>
	{:else if error}
		<hx-p class="error" role="alert">{error}</hx-p>
	{/if}
	{#if doc && view}
		<GameViewFields
			{view}
			views={doc.views}
			readonly={locked}
			bind:section={() => section, (name) => (tab = name)}
			select={(id) => (viewId = id)}
			create={(level) => doc && edit({ ...doc, views: [...doc.views, level] })}
			change={editView}
		/>
		{#if problems.length}
			<hx-p class="error" role="alert">Fix before saving or previewing: {problems.join(' ')}</hx-p>
		{/if}
		{#if section === 'Level'}
			<GameLevelPlan
				context={{ view, document: doc, projectId, revision, commit, bridge, readonly: locked }}
				bind:run
				change={editView}
			/>
		{:else if section === 'Checkpoints'}
			<GameGraph
				checkpoints={view.checkpoints}
				{run}
				{selected}
				select={(id) => (selected = id)}
				create={addCheckpoint}
				change={(nodes) => editView({ checkpoints: nodes })}
				readonly={locked}
			/>
			{#if checkpoint}
				<GameCheckpointPane
					context={{ checkpoint, view, document: doc, projectId, revision, commit, bridge }}
					adding={added?.node.id === checkpoint.id}
					readonly={locked}
					change={editCheckpoint}
					close={() => closeCheckpoint()}
					remove={removeCheckpoint}
				/>
			{/if}
			<GameTrace {run} {view} />
		{:else if section === 'Mechanics'}
			<GameMechanics mechanics={doc.mechanics} change={editMechanics} readonly={locked} />
		{:else if !problems.length}
			<GamePreview initialRun={run} {view} {projectId} readonly={locked} onRun={track} {bridge} />
		{/if}
	{:else if busy}
		<hx-p class="muted">Loading the game…</hx-p>
	{/if}
</hx-section>

<style>
	.game {
		display: grid;
		gap: var(--hx-space-16);
	}
	.back {
		justify-self: start;
		color: var(--hx-color-primary);
	}
</style>
