import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { modelDefinitions } from '../../../src/services/explorer-ui/revision-detail-service/modelDefinitions';
import type { HarnessUnit } from '../src/models/Harness.types';

const root = join(import.meta.dirname, '../../..');

/** The registry of this repository, as its manifests state it. */
export function ownRegistry(): HarnessUnit[] {
	const directory = join(root, 'specification/units');
	return readdirSync(directory)
		.filter((name) => name.endsWith('.json'))
		.map((name) => JSON.parse(readFileSync(join(directory, name), 'utf8')) as HarnessUnit);
}

/** Each model unit with the declarations its owned source holds now, as the explorer reads them. */
export function sourceDeclaredModels(units: HarnessUnit[]): HarnessUnit[] {
	return units
		.filter((item) => item.kind === 'model')
		.map((item) => ({
			...item,
			modelDefinitions: item.owns.source
				.filter((path) => /\.[cm]?tsx?$/.test(path))
				.flatMap((path) => modelDefinitions(readFileSync(join(root, path), 'utf8'), path))
		}));
}
