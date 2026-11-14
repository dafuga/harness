import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { componentManifestSchema } from '../../src/core/unitTypes';
import { unitDocumentation } from '../../src/utils/unit-documentation/unitDocumentation';
import type { DeclaredExamples } from './unitExamples.types';

export function declaredExamples(unitId: string, root = process.cwd()): DeclaredExamples {
	const manifestPath = resolve(root, 'specification/units', `${unitId}.json`);
	const unit = componentManifestSchema.parse(JSON.parse(readFileSync(manifestPath, 'utf8')));
	const helpers = (unit.helperContracts ?? [])
		.filter(({ examples }) => examples !== undefined)
		.map(({ name, source, examples }) => ({
			symbol: name,
			source,
			examples: examples ?? []
		}));
	const items = [...unit.contract.inputs, ...unit.contract.outputs, ...unit.contract.errors]
		.filter(({ examples }) => examples !== undefined)
		.map(({ name, type, examples }) => ({ name, type, examples: examples ?? [] }));
	let documentation: DeclaredExamples['documentation'];
	if (unit.documentation && existsSync(resolve(root, unit.documentation))) {
		const path = unit.documentation;
		documentation = unitDocumentation(readFileSync(resolve(root, path), 'utf8'), unitId, path);
	}
	return { helpers, documentation, items };
}
