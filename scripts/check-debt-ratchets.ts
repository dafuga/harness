import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

type LayerEdge = { from: string; to: string; todo: string };
type ReuseBaseline = Record<string, number>;

export function layerRatchet(before: LayerEdge[], after: LayerEdge[]) {
	const oldEdges = new Set(before.map(({ from, to }) => `${from} -> ${to}`));
	const newEdges = new Set(after.map(({ from, to }) => `${from} -> ${to}`));
	return {
		before: oldEdges.size,
		after: newEdges.size,
		added: [...newEdges].filter((edge) => !oldEdges.has(edge)).sort(),
		removed: [...oldEdges].filter((edge) => !newEdges.has(edge)).sort()
	};
}

export function reuseRatchet(before: ReuseBaseline, after: ReuseBaseline) {
	const added = Object.entries(after)
		.filter(([path, count]) => !(path in before) || count > before[path]!)
		.map(([path, count]) => `${path}: ${before[path] ?? 0} -> ${count}`)
		.sort();
	const reduced = Object.entries(before)
		.filter(([path, count]) => (after[path] ?? 0) < count)
		.map(([path, count]) => `${path}: ${count} -> ${after[path] ?? 0}`)
		.sort();
	return {
		before: Object.values(before).reduce((total, count) => total + count, 0),
		after: Object.values(after).reduce((total, count) => total + count, 0),
		added,
		reduced
	};
}

function baseRef(): string {
	if (process.env.GITHUB_BASE_REF) return `origin/${process.env.GITHUB_BASE_REF}`;
	const branch = execFileSync('git', ['branch', '--show-current'], { encoding: 'utf8' }).trim();
	const ref = branch && branch !== 'main' ? 'main' : 'HEAD^';
	return execFileSync('git', ['rev-parse', '--verify', ref], { encoding: 'utf8' }).trim();
}

function readBaseJson<T>(ref: string, path: string): T {
	const source = execFileSync('git', ['show', `${ref}:${path}`], { encoding: 'utf8' });
	return JSON.parse(source) as T;
}

function main(): void {
	const ref = baseRef();
	const previousLayers = readBaseJson<{ edges: LayerEdge[] }>(ref, 'eslint.layer-allowlist.json');
	const currentLayers = JSON.parse(readFileSync('eslint.layer-allowlist.json', 'utf8')) as {
		edges: LayerEdge[];
	};
	const layers = layerRatchet(previousLayers.edges, currentLayers.edges);
	const previousReuse = readBaseJson<ReuseBaseline>(ref, 'eslint.reuse-baseline.json');
	const currentReuse = JSON.parse(
		readFileSync('eslint.reuse-baseline.json', 'utf8')
	) as ReuseBaseline;
	const reuse = reuseRatchet(previousReuse, currentReuse);
	console.log(
		`Layer allowlist: ${layers.before} -> ${layers.after} entries (delta ${layers.after - layers.before}).`
	);
	console.log(
		`Reuse baseline: ${reuse.before} -> ${reuse.after} findings (delta ${reuse.after - reuse.before}).`
	);
	for (const edge of layers.added) console.error(`New upward import: ${edge}`);
	for (const entry of reuse.added) console.error(`Reuse baseline growth: ${entry}`);
	if (layers.added.length || reuse.added.length) process.exitCode = 1;
}

if (import.meta.main) main();
