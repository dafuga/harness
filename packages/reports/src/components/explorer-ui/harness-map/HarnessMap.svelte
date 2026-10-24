<!-- @harness-tier molecule -->
<!-- @harness-atoms ../../shared-primitives/atoms -->
<script lang="ts">
	import type { HarnessMark, HarnessUnit } from '../../../models/explorer-ui/Harness.types';
	import { harnessLayout } from './harnessLayout';
	import { nodeSize } from '../../../utils/explorer-ui/harnessLayout';
	import { drawnEdges, focusOn, nextNode, panView, zoomView } from './focusView';
	import { wholeView, type MapView } from '../../../utils/explorer-ui/focusView';
	import { mapUnitLabel, markLabels } from './mapUnitLabel';
	let {
		units,
		marks = new Map<string, HarnessMark>(),
		selected = null,
		onselect
	}: {
		units: HarnessUnit[];
		marks?: Map<string, HarnessMark>;
		selected?: string | null;
		onselect: (id: string) => void;
	} = $props();
	let search = $state('');
	let svg = $state<SVGSVGElement>();
	// Null shows the whole map; anything else is where the reader zoomed, panned or was taken.
	let view = $state<MapView | null>(null);
	let cursor = $state<string | null>(null);
	let picked: string | null = null;
	let drag: { id: number; x: number; y: number } | null = null;
	let pinch = new Map<number, { x: number; y: number }>();
	let layout = $derived(harnessLayout(units));
	let query = $derived(search.trim().toLowerCase());
	let matching = $derived(
		new Set(
			units
				.filter((unit) =>
					`${unit.id} ${unit.kind} ${unit.responsibility}`.toLowerCase().includes(query)
				)
				.map((unit) => unit.id)
		)
	);
	let listed = $derived(
		units
			.filter((unit) => matching.has(unit.id))
			.sort((left, right) => (left.id < right.id ? -1 : 1))
	);
	let near = $derived(
		new Set(
			layout.edges
				.filter((edge) => edge.from === selected || edge.to === selected)
				.flatMap((edge) => [edge.from, edge.to])
		)
	);
	let edges = $derived(drawnEdges(layout, selected));
	let whole = $derived(wholeView(layout));
	let shown = $derived(view ?? whole);
	// One unit is in the tab order; the arrow keys reach the rest.
	let tabStop = $derived(
		[cursor, selected].find((id) => id && matching.has(id)) ??
			layout.nodes.find((node) => matching.has(node.unit.id))?.unit.id
	);
	// A search goes to its matches, and a unit chosen outside the map is brought into view.
	$effect(() => {
		view = query ? focusOn(layout, matching) : null;
	});
	$effect(() => {
		if (selected && selected !== picked) view = focusOn(layout, new Set([selected]));
	});
	const label = (unit: HarnessUnit) => mapUnitLabel(unit, marks.get(unit.id));
	const short = (id: string) => (id.length > 27 ? `${id.slice(0, 26)}…` : id);
	/** Map units per screen pixel, for turning a drag into a pan. */
	function ratio(): number {
		const box = svg?.getBoundingClientRect();
		return box?.width ? Math.max(shown.width / box.width, shown.height / box.height) : 1;
	}
	function scale(factor: number) {
		view = zoomView(shown, factor, whole);
	}
	function pick(id: string) {
		picked = id;
		onselect(id);
	}
	function down(event: PointerEvent) {
		pinch.set(event.pointerId, { x: event.clientX, y: event.clientY });
		if ((event.target as Element).closest('.hc-node')) return;
		drag = { id: event.pointerId, x: event.clientX, y: event.clientY };
	}
	function move(event: PointerEvent) {
		const before = pinch.get(event.pointerId);
		if (before && pinch.size === 2) {
			const other = [...pinch.entries()].find(([id]) => id !== event.pointerId)?.[1];
			const was = other ? Math.hypot(before.x - other.x, before.y - other.y) : 0;
			if (other && was > 0)
				scale(Math.hypot(event.clientX - other.x, event.clientY - other.y) / was);
			pinch.set(event.pointerId, { x: event.clientX, y: event.clientY });
			return;
		}
		if (!drag || drag.id !== event.pointerId) return;
		const by = ratio();
		view = panView(shown, (drag.x - event.clientX) * by, (drag.y - event.clientY) * by);
		drag = { id: event.pointerId, x: event.clientX, y: event.clientY };
	}
	function up(event: PointerEvent) {
		pinch.delete(event.pointerId);
		if (drag?.id === event.pointerId) drag = null;
	}
	function key(event: KeyboardEvent, id: string) {
		const next = nextNode(layout, id, event.key, matching);
		if (next) {
			event.preventDefault();
			cursor = next;
			view = focusOn(layout, new Set([next]));
			svg?.querySelector<SVGGElement>(`[data-unit="${next}"]`)?.focus();
		}
		if (event.key !== 'Enter' && event.key !== ' ') return;
		event.preventDefault();
		pick(id);
	}
</script>
<hx-div class="hc-grid">
	<hx-div class="hc-card">
		<hx-input
			class="hc-search"
			type="search"
			aria-label="Search components"
			placeholder="Search components"
			bind:value={search}
		/>
		<hx-p class="hc-muted">{listed.length} of {units.length} components</hx-p>
		<hx-ul class="hc-list" aria-label="Components">
			{#each listed as unit (unit.id)}
				<hx-li>
					<hx-button
						type="button"
						aria-current={unit.id === selected ? 'true' : undefined}
						onclick={() => onselect(unit.id)}
						>{unit.id}{#if marks.get(unit.id)}
							<hx-small> · {markLabels[marks.get(unit.id) as HarnessMark]}</hx-small>{/if}<hx-br
						/><hx-small>{unit.responsibility}</hx-small></hx-button
					>
				</hx-li>
			{/each}
		</hx-ul>
	</hx-div>
	<hx-div class="hc-card hc-map">
		<hx-div class="hc-map-tools">
			<hx-button type="button" aria-label="Zoom in" onclick={() => scale(1.3)}>+</hx-button>
			<hx-button type="button" aria-label="Zoom out" onclick={() => scale(1 / 1.3)}>−</hx-button>
			<hx-button type="button" onclick={() => (view = null)}>Fit</hx-button>
			{#if edges.length < layout.edges.length}
				<hx-span class="hc-muted">Dependencies are drawn for the selected component.</hx-span>
			{/if}
		</hx-div>
		<hx-svg
			bind:this={svg}
			role="group"
			aria-label="Component map"
			viewBox="{shown.x} {shown.y} {shown.width} {shown.height}"
			onpointerdown={down}
			onpointermove={move}
			onpointerup={up}
			onpointercancel={up}
		>
			{#each edges as edge (edge.from + '>' + edge.to)}
				<hx-svg-line
					class="hc-edge"
					class:near={edge.from === selected || edge.to === selected}
					x1={edge.x1}
					y1={edge.y1}
					x2={edge.x2}
					y2={edge.y2}
				/>
			{/each}
			{#each layout.nodes as node (node.unit.id)}
				{@const visible = matching.has(node.unit.id)}
				<hx-svg-g
					class="hc-node {marks.get(node.unit.id) ?? ''}"
					class:selected={node.unit.id === selected}
					class:dimmed={!visible || (selected !== null && near.size > 0 && !near.has(node.unit.id))}
					role="button"
					tabindex={node.unit.id === tabStop ? 0 : -1}
					aria-hidden={visible ? undefined : 'true'}
					aria-label={label(node.unit)}
					aria-pressed={node.unit.id === selected}
					data-unit={node.unit.id}
					transform="translate({node.x} {node.y})"
					onclick={() => pick(node.unit.id)}
					onfocus={() => (cursor = node.unit.id)}
					onkeydown={(event) => key(event, node.unit.id)}
				>
					<hx-title>{node.unit.id}</hx-title>
					<hx-svg-rect width={nodeSize.width} height={nodeSize.height} rx="7" />
					<hx-svg-text x="9" y="21">{short(node.unit.id)}</hx-svg-text>
				</hx-svg-g>
			{/each}
		</hx-svg>
		{#if marks.size > 0}
			<hx-div class="hc-legend" aria-label="Map legend">
				<hx-span
					><hx-span class="hc-swatch" style="background:var(--hx-color-direct)"></hx-span>Directly
					changed</hx-span
				>
				<hx-span
					><hx-span class="hc-swatch" style="background:var(--hx-color-indirect)"
					></hx-span>Indirectly affected</hx-span
				>
				<hx-span
					><hx-span class="hc-swatch" style="background:var(--hx-color-added)"
					></hx-span>Added</hx-span
				>
				<hx-span
					><hx-span class="hc-swatch" style="background:var(--hx-color-removed)"
					></hx-span>Removed</hx-span
				>
			</hx-div>
		{/if}
	</hx-div>
</hx-div>
