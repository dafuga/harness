import { fail } from '../core/errors';
import type { FileWriteStatus } from '../core/files';
import type { ComponentManifest } from '../core/unitTypes';
import { scaffoldKinds, type PieceKind } from '../templates/scaffoldTypes';
import { stableJson } from '../utils/stableJson';
import { generatePiece, type GenerateResult } from "./generate-code/generateCode";
import { loadUnits } from './loadUnits';

export interface GenerateUnitInput {
	name: string;
	kind?: string;
	responsibility?: string;
	force?: boolean;
	root?: string;
}

const aliases: Record<string, PieceKind> = { function: 'util', endpoint: 'api', page: 'view' };
const withoutUnit = new Set<string>(['test', 'feature', 'e2e', 'resource']);

/** Scaffolds source for any unit kind and registers its manifest in one step. */
export async function generateUnit(input: GenerateUnitInput): Promise<GenerateResult> {
	const root = input.root ?? process.cwd();
	const piece = await generatePiece({
		kind: pieceKind(input.kind ?? 'function'),
		name: input.name,
		force: input.force,
		root
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
