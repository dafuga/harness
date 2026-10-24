<!-- @harness-tier organism -->
<!-- @harness-atoms ../../../../reports/src/components/shared-primitives/atoms -->
<script lang="ts">
	import { Background, BackgroundVariant, Controls, Position, SvelteFlow } from '@xyflow/svelte';
	import type { Connection, Edge, Node } from '@xyflow/svelte';
	import '@xyflow/svelte/dist/style.css';
	import { SvelteSet } from 'svelte/reactivity';
	import GameGraphFit from './GameGraphFit.svelte';
	import { checkpointEligible } from '../../../../game/src/utils/game-authoring/checkpointGraph';
	import type { Checkpoint, GameRun } from '../../../../game/src/models/game-authoring/Game.types';
	/**
	 * The checkpoint graph of one view. Checkpoints stay the source of truth: nodes and edges are
	 * rebuilt from them, and every drag or connection reaches the parent as a new checkpoint list,
	 * never as state kept here. An edge runs from a prerequisite to its dependant. Clicking a
	 * checkpoint, or Enter on a focused one, opens it through `select`; Add hands the parent a new
	 * checkpoint through `create`.
	 */
	let {
		checkpoints,
		run,
		selected,
		select,
		create,
		change,
		readonly = false
	}: {
		checkpoints: Checkpoint[];
		run: GameRun;
		selected: string | null;
		select: (id: string) => void;
		create: (node: Checkpoint) => void;
		change: (nodes: Checkpoint[]) => void;
		readonly?: boolean;
	} = $props();
	let nodes = $state.raw<Node[]>([]);
	let edges = $state.raw<Edge[]>([]);
	const done = $derived(checkpoints.filter((c) => run.completed.includes(c.id)).length);
	/** Reads only props and writes only the flow, so a parent update never feeds back into itself. */
	$effect.pre(() => {
		const ids = new Set(checkpoints.map((c) => c.id));
		nodes = checkpoints.map((c) => toNode(c, run.completed.includes(c.id), c.id === selected));
		edges = checkpoints.flatMap((c) =>
			c.requires.filter((r) => ids.has(r)).map((r) => toEdge(r, c.id))
		);
	});
	function toNode(c: Checkpoint, complete: boolean, active: boolean): Node {
		const title = c.title || c.id;
		let className = 'checkpoint';
		if (complete) className += ' completed';
		else if (checkpointEligible(c, run)) className += ' eligible';
		return {
			id: c.id,
			position: { x: c.x, y: c.y },
			data: { label: title },
			class: className,
			ariaLabel: complete ? `${title}, completed` : title,
			selected: active,
			sourcePosition: Position.Right,
			targetPosition: Position.Left
		};
	}
	function toEdge(source: string, target: string): Edge {
		return { id: `${source}->${target}`, source, target };
	}
	/** Whether `from` is `to` or requires it, directly or through other checkpoints. */
	function reaches(from: string, to: string, seen = new SvelteSet<string>()): boolean {
		if (from === to) return true;
		if (seen.has(from)) return false;
		seen.add(from);
		const node = checkpoints.find((c) => c.id === from);
		return !!node?.requires.some((r) => reaches(r, to, seen));
	}
	function valid({ source, target }: { source: string; target: string }) {
		const node = checkpoints.find((c) => c.id === target);
		return !!node && !node.requires.includes(source) && !reaches(source, target);
	}
	/** Only fires for connections `valid` accepted, so the target is new to this prerequisite. */
	function connect({ source, target }: Connection) {
		change(
			checkpoints.map((c) => (c.id === target ? { ...c, requires: [...c.requires, source] } : c))
		);
	}
	function moved({ nodes: dragged }: { nodes: Node[] }) {
		const at = new Map(dragged.map((n) => [n.id, n.position]));
		change(
			checkpoints.map((c) => {
				const p = at.get(c.id);
				return p ? { ...c, x: Math.round(p.x), y: Math.round(p.y) } : c;
			})
		);
	}
	function add() {
		const ids = new Set(checkpoints.map((c) => c.id));
		let n = checkpoints.length + 1;
		while (ids.has(`checkpoint-${n}`)) n++;
		const anchor = checkpoints.at(-1);
		const [x, y] = anchor ? [anchor.x + 260, anchor.y] : [80, 80];
		const node = { id: `checkpoint-${n}`, title: `Checkpoint ${n}`, description: '', x, y };
		create({ ...node, requires: [], conditions: [], actions: [] });
	}
	/** Enter on a focused checkpoint opens it, as a click does; the library keeps its own keys. */
	function openOnEnter(canvas: HTMLElement) {
		const keydown = (event: KeyboardEvent) => {
			const node = (event.target as Element).closest('.svelte-flow__node');
			const id = node?.getAttribute('data-id');
			if (event.key === 'Enter' && id) select(id);
		};
		canvas.addEventListener('keydown', keydown);
		return { destroy: () => canvas.removeEventListener('keydown', keydown) };
	}
</script>

<hx-section class="game-graph" data-harness-component="game-graph" aria-label="Checkpoint graph">
	<hx-header>
		<hx-p>
			<hx-strong>{done}</hx-strong> of {checkpoints.length} checkpoints complete
			<hx-span>· Select a checkpoint to {readonly ? 'view' : 'edit'} it</hx-span>
		</hx-p>
		{#if !readonly}
			<hx-button type="button" onclick={add}
				><hx-span aria-hidden="true">+</hx-span> Add checkpoint</hx-button
			>
		{/if}
	</hx-header>
	<hx-div class="canvas" use:openOnEnter>
		<SvelteFlow
			bind:nodes
			bind:edges
			colorMode="dark"
			fitView
			minZoom={0.1}
			fitViewOptions={{ minZoom: 0.1, maxZoom: 1 }}
			deleteKey={null}
			nodesDraggable={!readonly}
			nodesConnectable={!readonly}
			isValidConnection={valid}
			onnodeclick={({ node }) => select(node.id)}
			onnodedragstop={moved}
			onconnect={connect}
		>
			<Background variant={BackgroundVariant.Dots} gap={28} />
			<Controls showLock={false} showFitView={false}>
				<GameGraphFit />
			</Controls>
		</SvelteFlow>
	</hx-div>
</hx-section>

<style>
	@import './game-graph/gameGraph.css';
</style>
