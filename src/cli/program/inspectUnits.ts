import type { UnitDetail } from './inspectUnits.types';
import { z } from 'zod';
import { fail } from '../../core/development-tooling/errors';
import type { SourceGraph } from '../../core/development-tooling/sourceTypes';
import {
	componentManifestSchema,
	scenarioManifestSchema,
	type ComponentManifest
} from '../../core/development-tooling/unitTypes';
import { verificationRecordSchema } from '../../core/verification-evidence/verificationTypes';
import { fileNode, unitNode } from '../../services/development-tooling/SourceGraphService';
import { componentVersion } from '../../utils/development-tooling/componentVersion';
import { graphOf, loadUnits } from '../../workflows/development-tooling/load-units/loadUnits';
import type { UnitsOptions } from './manageUnits';

const schemas = {
	ComponentManifest: componentManifestSchema,
	ScenarioManifest: scenarioManifestSchema,
	VerificationRecord: verificationRecordSchema
};

export function unitSchema(name: string): unknown {
	const schema = schemas[name as keyof typeof schemas];
	if (!schema) {
		return fail(`Unknown schema "${name}". Use one of: ${Object.keys(schemas).join(', ')}.`);
	}
	return z.toJSONSchema(schema);
}

export async function listUnits(options: UnitsOptions & { kind?: string } = {}) {
	const loaded = await loadUnits(options.root);
	return loaded.stored
		.filter((unit) => unit.status === 'active' && (!options.kind || unit.kind === options.kind))
		.map((unit) => ({ id: unit.id, kind: unit.kind, responsibility: unit.responsibility }));
}

export async function unitsGraph(options: UnitsOptions = {}): Promise<SourceGraph> {
	return graphOf(await loadUnits(options.root));
}

export async function showUnit(id: string, options: UnitsOptions = {}): Promise<UnitDetail> {
	const loaded = await loadUnits(options.root);
	const manifest = loaded.stored.find((unit) => unit.id === id);
	if (!manifest) return fail(`Unknown unit "${id}".`);
	const byId = new Map(loaded.stored.map((unit) => [unit.id, unit]));
	const graph = graphOf(loaded);
	return {
		manifest,
		version: componentVersion(manifest, loaded.index.files),
		consumers: loaded.stored
			.filter((unit) => unit.dependencies.some((dependency) => dependency.unit === id))
			.map((unit) => unit.id),
		tests: dependentTests(graph, manifest),
		dependencies: manifest.dependencies.flatMap((dependency) => {
			const unit = byId.get(dependency.unit);
			return unit
				? [{ id: unit.id, responsibility: unit.responsibility, contract: unit.contract }]
				: [];
		})
	};
}

/** Walks the graph backwards from the unit's files to every test that reaches them. */
function dependentTests(graph: SourceGraph, manifest: ComponentManifest): string[] {
	const kinds = new Map(graph.nodes.map((node) => [node.id, node.kind]));
	const incoming = new Map<string, string[]>();
	for (const edge of graph.edges)
		incoming.set(edge.to, [...(incoming.get(edge.to) ?? []), edge.from]);
	const seen = new Set([unitNode(manifest.id), ...manifest.owns.source.map(fileNode)]);
	const queue = [...seen];
	for (let node = queue.shift(); node !== undefined; node = queue.shift()) {
		for (const dependent of incoming.get(node) ?? []) {
			if (seen.has(dependent)) continue;
			seen.add(dependent);
			queue.push(dependent);
		}
	}
	return [...seen]
		.filter((node) => kinds.get(node) === 'test' && /\.(?:test|spec)\.[tj]s$/.test(node))
		.map((node) => node.slice('file:'.length))
		.sort();
}

export { renderUnit } from './renderUnit';
export type { UnitDetail } from './inspectUnits.types';
