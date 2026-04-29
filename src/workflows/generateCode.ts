import { applyExports } from '../core/exports';
import type { ExportPlan } from '../core/exports';
import { fail } from '../core/errors';
import { ensureParents, renderFileList, writePlannedFiles, type FileWriteResult } from '../core/files';
import { detectProjectKind } from '../core/project';
import { validateCodeName } from '../core/validation';
import { parseFields } from '../core/fields';
import { adapterTypeFiles } from '../templates/adapterTypes';
import { modelFiles, type AdapterName } from '../templates/model';
import { pieceFiles, type PieceKind } from '../templates/pieces';
import { isAppOnlyScaffold, scaffoldKinds } from '../templates/scaffoldTypes';
import { adapterExportPlan, modelExportPlans, pieceExportPlans } from './exportPlans';

export { scaffoldKinds };
export type { PieceKind };

const adapters = ['d1', 'sqlite', 'postgres'] as const;

export interface GenerateModelInput {
	name: string;
	rawFields: string[];
	adapter: string;
	force?: boolean;
	root?: string;
}

export interface GeneratePieceInput {
	kind: PieceKind;
	name: string;
	force?: boolean;
	root?: string;
}

export interface GenerateResult {
	kind: string;
	name: string;
	writes: FileWriteResult[];
	exportsUpdated: boolean;
}

export async function generateModel(input: GenerateModelInput): Promise<GenerateResult> {
	const root = input.root ?? process.cwd();
	const name = validateCodeName(input.name);
	const adapter = normalizeAdapter(input.adapter);
	const files = [...adapterTypeFiles(), ...modelFiles({ name, fields: parseFields(input.rawFields), adapter })];

	await ensureParents(root, files);
	const writes = await writePlannedFiles(root, files, { force: input.force });
	const exportsUpdated = await maybeExport(root, [...modelExportPlans(name), adapterExportPlan(adapter)]);

	return { kind: 'model', name, writes, exportsUpdated };
}

export async function generatePiece(input: GeneratePieceInput): Promise<GenerateResult> {
	const root = input.root ?? process.cwd();
	const name = validateCodeName(input.name);
	const projectKind = await detectProjectKind(root);

	if (isAppOnlyScaffold(input.kind) && projectKind !== 'app') {
		fail(`The ${input.kind} scaffold is only available in Frame app projects.`);
	}

	const files = pieceFiles(input.kind, name);
	await ensureParents(root, files);
	const writes = await writePlannedFiles(root, files, { force: input.force });
	const exportsUpdated = projectKind === 'lib' ? await maybeExport(root, pieceExportPlans(input.kind, name)) : false;

	return { kind: input.kind, name, writes, exportsUpdated };
}

export function renderGenerateResult(result: GenerateResult): string {
	const exportLine = result.exportsUpdated ? '\n  update src/index.ts' : '';
	return `Generated ${result.kind} "${result.name}".\n${renderFileList(result.writes)}${exportLine}`;
}

function normalizeAdapter(value: string): AdapterName {
	if (adapters.includes(value as AdapterName)) {
		return value as AdapterName;
	}

	return fail(`Unsupported adapter "${value}". Use d1, sqlite, or postgres.`);
}

async function maybeExport(root: string, plans: ExportPlan[]): Promise<boolean> {
	const projectKind = await detectProjectKind(root);
	return projectKind === 'lib' ? applyExports(root, plans) : false;
}
