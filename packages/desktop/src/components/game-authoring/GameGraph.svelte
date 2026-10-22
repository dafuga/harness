<script lang="ts">
	import { Background, BackgroundVariant, Controls, Position, SvelteFlow } from '@xyflow/svelte';
	import type { Connection, Edge, Node } from '@xyflow/svelte';
	import '@xyflow/svelte/dist/style.css';
	import { SvelteSet } from 'svelte/reactivity';
	import { checkpointEligible } from '../../../../game/src/utils/game-authoring/checkpointGraph';
	import type { Checkpoint, GameRun } from '../../../../game/src/models/game-authoring/Game.types';
	/**
	 * The checkpoint graph of one view. Checkpoints stay the source of truth: nodes and edges are
	 * rebuilt from them, and every drag, connection, addition or removal reaches the parent as a new
	 * checkpoint list, never as state kept here. An edge runs from a prerequisite to its dependant.
	 */
	let {
		checkpoints,
		run,
		selected,
		select,
		change,
		readonly = false
	}: {
		checkpoints: Checkpoint[];
		run: GameRun;
		selected: string | null;
		select: (id: string) => void;
		change: (nodes: Checkpoint[]) => void;
		readonly?: boolean;
	} = $props();
	let nodes = $state.raw<Node[]>([]);
	let edges = $state.raw<Edge[]>([]);
	const done = $derived(checkpoints.filter((c) => run.completed.includes(c.id)).length);
	const current = $derived(checkpoints.find((c) => c.id === selected));
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
		const id = `checkpoint-${n}`;
		const anchor = current ?? checkpoints.at(-1);
		const [x, y] = anchor ? [anchor.x + 260, anchor.y] : [80, 80];
		const node = { id, title: `Checkpoint ${n}`, description: '', x, y };
		change([...checkpoints, { ...node, requires: [], conditions: [], actions: [] }]);
		select(id);
	}
	function remove() {
		const id = current?.id;
		if (!id) return;
		const rest = checkpoints
			.filter((c) => c.id !== id)
			.map((c) => ({ ...c, requires: c.requires.filter((r) => r !== id) }));
		change(rest);
		if (rest[0]) select(rest[0].id);
	}
</script>

<section class="game-graph" data-harness-component="game-graph" aria-label="Checkpoint graph">
	<header>
		<p><strong>{done}</strong> of {checkpoints.length} checkpoints complete</p>
		{#if !readonly}
			<button type="button" onclick={add}>Add checkpoint</button>
			<button type="button" disabled={!current} onclick={remove}>Delete checkpoint</button>
		{/if}
	</header>
	<div class="canvas">
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
			<Controls showLock={false} fitViewOptions={{ minZoom: 0.1, maxZoom: 1 }} />
		</SvelteFlow>
	</div>
</section>

<style>
	.game-graph {
		display: grid;
		grid-template-rows: auto minmax(0, 1fr);
		gap: 16px;
		height: 100%;
	}
	header {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px;
	}
	header p {
		margin: 0;
		margin-inline-end: auto;
		color: var(--muted);
	}
	header strong {
		color: var(--gold);
	}
	button:hover:not(:disabled) {
		border-color: var(--gold);
		color: var(--gold);
	}
	.canvas {
		min-height: 380px;
		overflow: hidden;
		border: 1px solid var(--line);
		border-radius: 12px;
		--xy-background-color: var(--panel);
		--xy-background-pattern-color: var(--line);
		--xy-node-background-color: color-mix(in srgb, var(--panel) 70%, #000);
		--xy-node-border: 1px solid var(--line);
		--xy-node-boxshadow-selected: 0 0 0 1px var(--gold);
		--xy-edge-stroke: var(--line);
		--xy-edge-stroke-selected: var(--gold);
		--xy-connectionline-stroke: var(--gold);
		--xy-handle-background-color: var(--gold);
		--xy-controls-button-background-color: var(--panel);
		--xy-controls-button-color: var(--muted);
		--xy-controls-button-color-hover: var(--gold);
	}
	.canvas :global(.svelte-flow__node.checkpoint) {
		width: 184px;
		padding: 14px 18px;
		border-radius: 10px;
		text-align: start;
		font-size: 14px;
		font-weight: 600;
	}
	.canvas :global(.svelte-flow__node.eligible) {
		border-color: var(--gold);
	}
	.canvas :global(.svelte-flow__node.completed) {
		border-color: color-mix(in srgb, var(--gold) 55%, transparent);
	}
	.canvas :global(.svelte-flow__node.completed::after) {
		content: 'Completed';
		display: block;
		margin-top: 6px;
		color: var(--gold);
		font-size: 0.72rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}
</style>
