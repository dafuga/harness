import type { GenerateUnitInput } from './generateUnit.types';
import { fail } from '../../core/development-tooling/errors';
import type { FileWriteStatus } from '../../core/development-tooling/files';
import type { ComponentManifest } from '../../core/development-tooling/unitTypes';
import { scaffoldKinds, type PieceKind } from '../../templates/development-tooling/scaffoldTypes';
import { stableJson } from '../../utils/development-tooling/stableJson';
import {
	generatePiece,
	type GenerateResult
} from '../../workflows/projects-sessions/generate-code/generateCode';
import { loadUnits } from '../../workflows/development-tooling/load-units/loadUnits';

const aliases: Record<string, PieceKind> = { function: 'util', endpoint: 'api', page: 'view' };
const withoutUnit = new Set<string>(['test', 'feature', 'e2e', 'resource']);

/** Scaffolds source for any unit kind and registers its manifest in one step. */
export async function generateUnit(input: GenerateUnitInput): Promise<GenerateResult> {
	const root = input.root ?? process.cwd();
	const piece = await generatePiece({
		kind: pieceKind(input.kind ?? 'function'),
		name: input.name,
		force: input.force,
		root,
		group: input.group,
		level: input.level,
		responsibility: input.responsibility
	});
	const loaded = await loadUnits(root);
	const generated = new Set(piece.writes.map((write) => write.path));
	const derived = loaded.fresh.manifests.find(
		(unit) => unit.status === 'active' && unit.owns.source.some((path) => generated.has(path))
	);
	if (!derived) return fail('The generated files do not form a unit.');
	const manifest: ComponentManifest = input.responsibility
		? { ...derived, responsibility: input.responsibility.trim(), responsibilityOrigin: 'declared' }
		: derived;
	const path = loaded.repository.path(manifest.id);
	const written = (await loaded.repository.write([manifest])).includes(path);
	const replaced = loaded.stored.some((unit) => unit.id === manifest.id)
		? 'overwritten'
		: 'created';
	const status: FileWriteStatus = written ? replaced : 'skipped';
	return {
		kind: 'unit',
		name: piece.name,
		writes: [...piece.writes, { path, contents: stableJson(manifest), status }],
		exportsUpdated: piece.exportsUpdated
	};
}

function pieceKind(kind: string): PieceKind {
	const resolved = aliases[kind] ?? kind;
	const known = scaffoldKinds.find((item) => item === resolved);
	if (known && !withoutUnit.has(known)) return known;
	const supported = ['function', ...scaffoldKinds.filter((item) => !withoutUnit.has(item))];
	return fail(`Unsupported unit kind "${kind}". Use one of: ${supported.join(', ')}.`);
}

export type { GenerateUnitInput } from './generateUnit.types';
