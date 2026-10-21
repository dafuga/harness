import type { HarnessLayout, PlacedUnit } from '../../../utils/harnessLayout';
import { nodeSize } from '../../../utils/harnessLayout';
import type { HarnessUnit } from '../../../models/Harness.types';

/** How far a unit is from the units that depend on nothing: its layer in the map. */
function depths(units: HarnessUnit[]): Map<string, number> {
	const known = new Map(units.map((unit) => [unit.id, unit]));
	const depth = new Map<string, number>();
	const visit = (id: string, path: Set<string>): number => {
		const done = depth.get(id);
		if (done !== undefined) return done;
		if (path.has(id)) return 0;
		const next = new Set(path).add(id);
		const below = (known.get(id)?.dependencies ?? [])
			.filter((dependency) => known.has(dependency.unit))
			.map((dependency) => visit(dependency.unit, next) + 1);
		const value = Math.max(0, ...below);
		depth.set(id, value);
		return value;
	};
	for (const unit of units) visit(unit.id, new Set());
	return depth;
}

/** Units per row: six for a small map, more as it grows, so the block stays about as wide as tall. */
export function mapColumns(count: number): number {
	return Math.min(24, Math.max(6, Math.ceil(Math.sqrt(count * 0.75))));
}

/**
 * Places units in layers by dependency depth, foundations at the bottom, and wraps wide layers
 * so the map of a few hundred units stays a readable block. The layout is a pure function of
 * the units, so the same revision always draws the same map.
 */
export function harnessLayout(
	units: HarnessUnit[],
	perRow = mapColumns(units.length)
): HarnessLayout {
	const depth = depthsOf(units);
	const layers = [...new Set(depth.values())].sort((left, right) => right - left);
	const nodes: PlacedUnit[] = [];
	let row = 0;
	for (const layer of layers) {
		const members = units.filter((unit) => depth.get(unit.id) === layer);
		members.sort((left, right) => (left.id < right.id ? -1 : 1));
		members.forEach((unit, index) => {
			nodes.push({
				unit,
				x: (index % perRow) * (nodeSize.width + nodeSize.gapX),
				y: (row + Math.floor(index / perRow)) * (nodeSize.height + nodeSize.gapY)
			});
		});
		row += Math.ceil(members.length / perRow);
	}
	const at = new Map(nodes.map((node) => [node.unit.id, node]));
	// A unit may depend on another in several ways; the map draws the pair once.
	const edges = units.flatMap((unit) =>
		[...new Set(unit.dependencies.map((dependency) => dependency.unit))].flatMap((target) => {
			const dependency = { unit: target };
			const [from, to] = [at.get(unit.id), at.get(dependency.unit)];
			if (!from || !to) return [];
			const half = nodeSize.width / 2;
			return [
				{
					from: unit.id,
					to: dependency.unit,
					x1: from.x + half,
					y1: from.y + nodeSize.height,
					x2: to.x + half,
					y2: to.y
				}
			];
		})
	);
	const columns = Math.min(perRow, Math.max(1, ...layers.map((layer) => count(depth, layer))));
	return {
		nodes,
		edges,
		width: columns * (nodeSize.width + nodeSize.gapX) - nodeSize.gapX,
		height: Math.max(1, row) * (nodeSize.height + nodeSize.gapY) - nodeSize.gapY
	};
}

const depthsOf = depths;

function count(depth: Map<string, number>, layer: number): number {
	return [...depth.values()].filter((value) => value === layer).length;
}
