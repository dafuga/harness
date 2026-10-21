<script lang="ts">
	import { resolve } from '$app/paths';
	import { untrack } from 'svelte';
	import GameViewFields from './GameViewFields.svelte';
	import { createRun, exampleDocument, validateDocument, enterView } from '../../../game/src/index';
	import type { Checkpoint, GameDocument, GameRun, GameView } from '../../../game/src/index';
	import type { DesktopBridge } from '../models/DesktopBridge.types';
	import GameCheckpointPane from './GameCheckpointPane.svelte';
	import GameGraph from './GameGraph.svelte';
	import GameMechanics from './GameMechanics.svelte';
	import GamePreview from './GamePreview.svelte';
	import GameTrace from './GameTrace.svelte';
	interface Props {
		projectId?: string | null;
		commit?: string;
		readonly?: boolean;
		bridge?: DesktopBridge;
	}
	type Source = Pick<Props, 'projectId' | 'commit' | 'bridge'>;
	const tabs = ['Preview', 'Checkpoints', 'Mechanics'] as const;
	let { projectId = null, commit, readonly = false, bridge }: Props = $props();
	let doc = $state.raw<GameDocument>();
	let revision = $state<string>();
	let viewId = $state('');
	let tab = $state<(typeof tabs)[number]>('Preview');
	let run = $state.raw<GameRun>(createRun());
	let selected = $state<string | null>(null);
	let dirty = $state(false);
	let busy = $state(false);
	let conflict = $state(false);
	let error = $state('');
	let request = 0;
	const demo = $derived(!projectId || !bridge?.gameRead);
	const editable = $derived(!readonly && !commit && (demo || Boolean(bridge?.gameSave)));
	const problems = $derived(doc ? validateDocument(doc) : []);
	const savable = $derived(editable && dirty && !busy && !problems.length);
	const view = $derived(doc?.views.find((item) => item.id === viewId) ?? doc?.views[0]);
	const checkpoint = $derived(view?.checkpoints.find((item) => item.id === selected));
	const text = (cause: unknown) => (cause instanceof Error ? cause.message : String(cause));
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
		error = '';
		conflict = false;
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
		selected = null;
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
	function editMechanics(list: GameDocument['mechanics']) {
		if (doc) edit({ ...doc, mechanics: list });
	}
	function createView() {
		if (!doc || !view || !editable) return;
		const id = 'view-' + Date.now().toString(36);
		edit({ ...doc, views: [...doc.views, { ...structuredClone(view), id, title: 'New view' }] });
		viewId = id;
	}
	$effect(() => {
		const source = { projectId, commit, bridge };
		untrack(() => void load(source));
	});
</script>

<section class="game" data-harness-component="game-workspace">
	<a class="back" href={resolve('/harness')}><span aria-hidden="true">←</span> Back to project</a>
	<header class="row" style="flex-wrap:wrap">
		<h1>Game Views</h1>
		{#if demo}<span class="chip gold">Demo</span>{/if}
		{#if commit}<span class="chip">History · {commit.slice(0, 8)}</span>{/if}
		{#if readonly && !commit}<span class="chip">Read-only</span>{/if}
		{#if dirty}<span class="chip gold">Unsaved changes</span>{/if}
		{#if !demo && editable}
			<button class="primary" disabled={!savable} onclick={save}>Save</button>
		{/if}
	</header>
	{#if demo}<p class="muted">Demo: an in-memory example. Nothing here is saved.</p>{/if}
	{#if conflict}
		<p class="error" role="alert">
			This game was saved elsewhere since it was opened. Your edits are still here.
			<button onclick={() => load({ projectId, commit, bridge })}>Discard edits and reload</button>
		</p>
	{:else if error}
		<p class="error" role="alert">{error}</p>
	{/if}
	{#if doc && view}
		<GameViewFields
			{view}
			views={doc.views}
			readonly={!editable}
			select={(id) => (viewId = id)}
			create={createView}
			change={editView}
		/>
		{#if problems.length}
			<p class="error" role="alert">Fix before saving or previewing: {problems.join(' ')}</p>
		{/if}
		<div class="row" style="flex-wrap:wrap" role="group" aria-label="Game sections">
			{#each tabs as name (name)}
				<button class:gold={tab === name} aria-pressed={tab === name} onclick={() => (tab = name)}>
					{name}
				</button>
			{/each}
		</div>
		{#if tab === 'Checkpoints'}
			<div class="split">
				<GameGraph
					checkpoints={view.checkpoints}
					{run}
					{selected}
					select={(id) => (selected = id)}
					change={(nodes) => editView({ checkpoints: nodes })}
					readonly={!editable}
				/>
				{#if checkpoint}
					<GameCheckpointPane
						context={{ checkpoint, view, document: doc, projectId, revision, commit, bridge }}
						change={editCheckpoint}
						readonly={!editable}
					/>
				{:else}
					<p class="muted">Select a checkpoint to inspect it.</p>
				{/if}
			</div>
			<GameTrace {run} {view} />
		{:else if tab === 'Mechanics'}
			<GameMechanics mechanics={doc.mechanics} change={editMechanics} readonly={!editable} />
		{:else if !problems.length}
			<GamePreview
				initialRun={run}
				{view}
				{projectId}
				readonly={!editable}
				onRun={track}
				{bridge}
			/>
		{/if}
	{:else if busy}
		<p class="muted">Loading the game…</p>
	{/if}
</section>

<style>
	.game {
		display: grid;
		gap: 16px;
	}
	.back {
		justify-self: start;
		color: var(--gold);
	}
	h1 {
		flex: 1;
		margin: 0;
	}
	.split {
		display: grid;
		grid-template-columns: minmax(0, 2fr) minmax(280px, 1fr);
		gap: 16px;
		align-items: start;
	}
	@media (max-width: 760px) {
		.split {
			grid-template-columns: minmax(0, 1fr);
		}
	}
</style>
