// @harness-uid u_76b76sztpq
import type { UnitDetail } from './inspectUnits.types';
import { z } from 'zod';
import { fail } from '../../core/development-tooling/errors';
import type { SourceGraph } from '../../core/development-tooling/sourceTypes';
import {
	componentManifestSchema,
	scenarioManifestSchema
} from '../../core/development-tooling/unitTypes';
import { verificationRecordSchema } from '../../core/verification-evidence/verificationTypes';
import { testAttribution } from './testAttribution';
import { declarationRole } from '../../services/explorer-ui/revision-detail-service/declarationRole';
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
	const manifests = loaded.fresh.manifests;
	const manifest = manifests.find((unit) => unit.id === id);
	if (!manifest) return fail(`Unknown unit "${id}".`);
	const byId = new Map(manifests.map((unit) => [unit.id, unit]));
	const graph = graphOf(loaded, manifests);
	const attribution = testAttribution(graph, manifest, loaded.scenarios);
	return {
		manifest,
		version: componentVersion(manifest, loaded.index.files),
		consumers: manifests
			.filter((unit) => unit.dependencies.some((dependency) => dependency.unit === id))
			.map((unit) => unit.id),
		tests: [...attribution.directImports, ...attribution.transitiveImpacts]
			.map((test) => test.file)
			.sort(),
		testAttribution: attribution,
		declarations: manifest.owns.source.flatMap((source) => {
			const file = loaded.index.files.get(source);
			return (
				file?.exports.map((symbol) => ({
					name: symbol.name,
					source,
					role: declarationRole(
						symbol.kind,
						Boolean(file.storage?.some((table) => table.name === symbol.name))
					)
				})) ?? []
			);
		}),
		dependencies: manifest.dependencies.flatMap((dependency) => {
			const unit = byId.get(dependency.unit);
			return unit
				? [{ id: unit.id, responsibility: unit.responsibility, contract: unit.contract }]
				: [];
		})
	};
}

export { renderUnit } from './renderUnit';
export type { UnitDetail } from './inspectUnits.types';
