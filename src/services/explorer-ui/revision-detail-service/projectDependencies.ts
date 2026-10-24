import { parse } from 'smol-toml';
import { pathMatches } from '../../../core/development-tooling/unitsConfig';
import type { SourceTree } from '../../../core/development-tooling/sourceTypes';
import type { ProjectDependencies, ProjectDependency } from './projectDependencies.types';

const object = (value: unknown): Record<string, unknown> =>
	value && typeof value === 'object' && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: {};
const strings = (value: unknown): string[] =>
	Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
const npmKinds = {
	dependencies: 'runtime',
	devDependencies: 'development',
	peerDependencies: 'peer',
	optionalDependencies: 'optional'
} as const;
const cargoKinds = {
	dependencies: 'runtime',
	'dev-dependencies': 'development',
	'build-dependencies': 'build'
} as const;

/** Read only the selected Git tree; manifests and scripts are never executed. */
export async function projectDependencies(tree: SourceTree): Promise<ProjectDependencies> {
	const catalog: ProjectDependencies = { entries: [], gaps: [] };
	const paths = new Set((await tree.list()).map((entry) => entry.path));
	const roots = ['package.json', 'Cargo.toml'].filter((path) => paths.has(path));
	if (!roots.length) catalog.gaps.push('No package manifests are recorded at this revision.');
	for (const source of roots) {
		const root = await readManifest(tree, source, catalog);
		if (!root) continue;
		const npm = source === 'package.json';
		const workspace = object(root.workspace);
		const patterns = npm
			? strings(Array.isArray(root.workspaces) ? root.workspaces : object(root.workspaces).packages)
			: strings(workspace.members);
		const excluded = npm ? [] : strings(workspace.exclude);
		const candidates = [...paths].filter((path) => {
			if (path === source) return true;
			if (!path.endsWith('/' + source)) return false;
			const directory = path.slice(0, -source.length - 1);
			return (
				patterns.some((pattern) => pathMatches(directory, pattern.replace(/\/$/, ''))) &&
				!excluded.some((pattern) => pathMatches(directory, pattern))
			);
		});
		for (const path of candidates.sort()) {
			const manifest = path === source ? root : await readManifest(tree, path, catalog);
			if (manifest)
				declarations(
					{ manifest, source: path, npm, inherited: object(workspace.dependencies) },
					catalog
				);
		}
	}
	catalog.entries.sort((a, b) =>
		`${a.ecosystem}/${a.name}/${a.source}/${a.kind}`.localeCompare(
			`${b.ecosystem}/${b.name}/${b.source}/${b.kind}`
		)
	);
	return catalog;
}

async function readManifest(tree: SourceTree, source: string, catalog: ProjectDependencies) {
	try {
		const text = await tree.read(source);
		if (text.length > 131072) throw Error('Manifest exceeds 128 KiB');
		const parsed: unknown = source.endsWith('.json') ? JSON.parse(text) : parse(text);
		if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
			throw Error('Expected manifest object');
		return object(parsed);
	} catch {
		catalog.gaps.push(`${source} could not be read at this revision.`);
		return null;
	}
}

function declarations(
	input: {
		manifest: Record<string, unknown>;
		source: string;
		npm: boolean;
		inherited: Record<string, unknown>;
	},
	catalog: ProjectDependencies
) {
	const { manifest, source, npm, inherited } = input;
	const packageInfo = npm ? manifest : object(manifest.package);
	const workspace =
		typeof packageInfo.name === 'string'
			? packageInfo.name
			: source.replace(/\/?(?:package\.json|Cargo\.toml)$/, '') || 'Root';
	const sections = [{ value: manifest, condition: '' }];
	if (!npm)
		for (const [condition, value] of Object.entries(object(manifest.target)))
			sections.push({ value: object(value), condition });
	for (const section of sections)
		for (const [field, kind] of Object.entries(npm ? npmKinds : cargoKinds)) {
			for (const [name, specification] of Object.entries(object(section.value[field]))) {
				const version = npm
					? typeof specification === 'string'
						? specification
						: null
					: cargoVersion(specification, inherited[name]);
				if (version === null) {
					catalog.gaps.push(`${source}: ${name} has no readable version or source declaration.`);
					continue;
				}
				const entry: ProjectDependency = {
					name,
					version,
					kind,
					ecosystem: npm ? 'npm' : 'cargo',
					workspace,
					source
				};
				if (section.condition) entry.condition = section.condition;
				catalog.entries.push(entry);
			}
		}
}

function cargoVersion(value: unknown, inherited: unknown): string | null {
	if (typeof value === 'string') return value;
	let spec = object(value);
	if (spec.workspace === true) {
		if (typeof inherited === 'string') return inherited;
		spec = object(inherited);
	}
	if (typeof spec.version === 'string') return spec.version;
	if (typeof spec.path === 'string') return `path:${spec.path}`;
	if (typeof spec.git !== 'string') return null;
	const revision = spec.rev ?? spec.tag ?? spec.branch;
	return `git:${spec.git}${typeof revision === 'string' ? '#' + revision : ''}`;
}
