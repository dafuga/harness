import { createHash } from 'node:crypto';
import type { ModuleDataIdentity } from '../../../../src/repositories/git-source-history/ModuleDataRepository.types';
import {
	loadUnits,
	graphOf
} from '../../../../src/workflows/development-tooling/load-units/loadUnits';
import { revisionRegistry } from '../../../../src/utils/revisionRegistry';
import { unitMetadata } from '../../../../src/services/explorer-ui/revision-detail-service/unitMetadata';
import { unitMeasurements } from '../../../../src/utils/development-tooling/unitMeasurements';
import { componentVersion } from '../../../../src/utils/development-tooling/componentVersion';
import { canonicalJson } from '../../../../src/utils/development-tooling/canonicalJson';
import { moduleDataProducer } from '../../../../src/services/git-source-history/module-data-service/moduleDataProtocol';
import { moduleRelationships } from '../../../../src/services/git-source-history/module-data-service/moduleRelationships';
import { modulePreviewBindings } from '../../../../src/services/git-source-history/module-data-service/modulePreviewBindings';
import { ModuleDataValidator } from '../../../../src/validators/development-tooling/ModuleDataValidator';
import { BudgetLedgerRepository } from '../../../../src/repositories/BudgetLedgerRepository';
import { BudgetService } from '../../../../src/services/budget-service/BudgetService';

/** Author synthetic committed metadata from the fixture's own bytes, without invented captures. */
export async function moduleFixtureSnapshot(
	identity: ModuleDataIdentity,
	files: Map<string, Uint8Array>
) {
	const tree = fixtureTree(identity.commit, files);
	const loaded = await loadUnits(process.cwd(), tree),
		declarations = loaded.fresh.manifests;
	const ledger = await new BudgetLedgerRepository(process.cwd()).read(tree);
	const blobs = new Map((await tree.list()).map((entry) => [entry.path, entry.hash]));
	const limits = new BudgetService().baselines(ledger.events, declarations);
	const registry = revisionRegistry(declarations, loaded.scenarios, blobs, limits);
	await unitMetadata(tree, registry.units);
	modulePreviewBindings(registry, declarations);
	for (const unit of registry.units) {
		const declaration = declarations.find((item) => item.id === unit.id)!;
		unit.sourceMeasurements = unitMeasurements(declaration, loaded.index.files, identity.commit);
	}
	const sourceGraph = graphOf(loaded, declarations);
	const validation = new ModuleDataValidator().validate(
		{ commit: identity.commit, registry, records: [], regressions: [] },
		identity.tree
	);
	validation.issues.push(...loaded.errors);
	const body = {
		schemaVersion: 1 as const,
		producer: moduleDataProducer,
		...identity,
		declarations,
		registry,
		reviews: [],
		references: sourceGraph.uncertain,
		sourceGraph,
		versions: Object.fromEntries(
			declarations.map((unit) => [unit.id, componentVersion(unit, loaded.index.files)])
		),
		relationships: moduleRelationships(registry),
		sourceIssues: loaded.errors,
		...validation
	};
	return { ...body, digest: fixtureDigest(body) };
}

export function fixtureDigest(value: unknown) {
	return createHash('sha256').update(canonicalJson(value)).digest('hex');
}

export function blobHash(bytes: Uint8Array) {
	return createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
}

function fixtureTree(commit: string, files: Map<string, Uint8Array>) {
	return {
		revision: commit,
		list: async () => [...files].map(([path, bytes]) => ({ path, hash: blobHash(bytes) })),
		read: async (path: string) => {
			const bytes = files.get(path);
			if (!bytes) throw new Error(`Missing fixture source: ${path}`);
			return new TextDecoder().decode(bytes);
		}
	};
}
