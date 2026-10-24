import type { Declared } from './deriveManifest.types';
import type { DeriveInput } from '../../../../utils/development-tooling/deriveManifest';
import type { SourceFile } from '../../../../core/development-tooling/sourceTypes';
import type {
	ComponentManifest,
	ContractItem,
	UnitDependency
} from '../../../../core/development-tooling/unitTypes';
import { derivedResponsibility } from './derivedResponsibility';

const viaPriority = ['import', 'reexport', 'dynamic-import', 'require', 'url', 'style-import'];

/** Builds a manifest from source facts while preserving everything a person declared. */
export function deriveManifest(input: DeriveInput): ComponentManifest {
	const { files } = input;
	const source = files.map((file) => file.path).sort();
	const kept = input.previous ?? defaults(input);
	const preview = kept.preview;
	const documentation = kept.documentation;
	const catalog = kept.catalog;
	return {
		schemaVersion: 1,
		id: input.id,
		kind: kept.kind,
		title: kept.title,
		responsibility:
			kept.responsibilityOrigin === 'declared'
				? kept.responsibility
				: derivedResponsibility(kept.kind, kept.title),
		responsibilityOrigin: kept.responsibilityOrigin,
		status: 'active',
		...(documentation ? { documentation } : {}),
		...(catalog ? { catalog } : {}),
		...(kept.configControls ? { configControls: kept.configControls } : {}),
		...lineage(input),
		owns: { source, symbols: files.flatMap((file) => file.exports.map((symbol) => symbol.name)) },
		contract: kept.contract.origin === 'declared' ? kept.contract : derivedContract(files),
		dependencies: [...derivedDependencies(input), ...declaredDependencies(input.previous)],
		...(kept.helperContracts?.length ? { helperContracts: kept.helperContracts } : {}),
		runtime: runtime(input.previous, source),
		scenarios: kept.scenarios,
		...(preview ? { preview } : {}),
		budgets: kept.budgets
	};
}

function defaults(input: DeriveInput): Declared {
	return {
		kind: input.kind,
		title: title(input.files[0].path),
		responsibility: '',
		responsibilityOrigin: 'derived',
		...(input.kind === 'config' ? { catalog: { visibility: 'internal' as const } } : {}),
		contract: { origin: 'derived', inputs: [], outputs: [], errors: [] },
		scenarios: [],
		budgets: { size: 'frozen', complexity: 'frozen', performance: [] }
	};
}

function derivedContract(files: SourceFile[]): ComponentManifest['contract'] {
	const symbols = files.flatMap((file) => file.exports);
	const outputs: ContractItem[] = symbols
		.filter((symbol) => symbol.output !== undefined && !symbol.name.endsWith('.constructor'))
		.map((symbol) => ({ name: symbol.name, type: symbol.output ?? 'unknown' }));
	const errors = [...new Set(files.flatMap((file) => file.errors))].sort();
	return {
		origin: 'derived',
		inputs: symbols.flatMap((symbol) => symbol.inputs),
		outputs,
		errors: errors.map((name) => ({ name, type: 'thrown' }))
	};
}

function derivedDependencies(input: DeriveInput): UnitDependency[] {
	const vias = new Map<string, string>();
	for (const reference of input.files.flatMap((file) => file.references)) {
		const unit = reference.path ? input.owners.get(reference.path) : undefined;
		if (!unit || unit === input.id) continue;
		const current = vias.get(unit);
		if (!current || viaPriority.indexOf(reference.via) < viaPriority.indexOf(current)) {
			vias.set(unit, reference.via);
		}
	}
	return [...vias.entries()]
		.sort(([left], [right]) => (left < right ? -1 : 1))
		.map(([unit, via]) => ({ unit, via: via as UnitDependency['via'], origin: 'derived' }));
}

function declaredDependencies(previous: ComponentManifest | undefined): UnitDependency[] {
	return previous?.dependencies.filter((dependency) => dependency.origin === 'declared') ?? [];
}

/** Lineage only grows: links recorded once are never dropped by a later index. */
function lineage(input: DeriveInput): Pick<ComponentManifest, 'lineage'> {
	const recorded = input.previous?.lineage?.predecessors ?? [];
	const predecessors = [...new Set([...recorded, ...(input.predecessors ?? [])])].sort();
	return predecessors.length > 0 ? { lineage: { predecessors } } : {};
}

/** Keeps a declared runtime; a module default follows its source and keeps the other targets. */
function runtime(
	previous: ComponentManifest | undefined,
	source: string[]
): ComponentManifest['runtime'] {
	const declared = previous?.runtime;
	if (declared && (declared.kind !== 'module' || source.includes(declared.entry))) return declared;
	const entry = source.find((path) => path.endsWith('.svelte')) ?? source[0];
	const module = declared?.targets.find((target) => target.kind === 'module');
	const others = declared?.targets.filter((target) => target.kind !== 'module') ?? [];
	return {
		...declared,
		kind: 'module',
		entry,
		targets: [{ ...module, kind: 'module', entry }, ...others]
	};
}

function title(path: string): string {
	const segments = path.split('/');
	const file = segments.at(-1) ?? path;
	if (segments[0] === 'crates') return segments[1];
	if (!file.startsWith('+')) return file.replace(/\.[a-z0-9.]+$/i, '');
	const route = path.slice(path.indexOf('routes/') + 7, -file.length - 1);
	return `/${route}`.replace(/\/$/, '') || '/';
}
