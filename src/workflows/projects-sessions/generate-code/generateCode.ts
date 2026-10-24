import type { GenerateModelInput, GenerateResult, GeneratePieceInput } from './generateCode.types';
import { applyExports } from './exports';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { ExportPlan } from '../../../core/projects-sessions/exports';
import { fail } from '../../../core/development-tooling/errors';
import {
	ensureParents,
	renderFileList,
	writePlannedFiles
} from '../../../core/development-tooling/files';
import { detectGameDimension, detectProjectKind } from './project';
import { validateCodeName } from '../../../core/development-tooling/validation';
import { parseFields } from '../../../core/development-tooling/fields/fields';
import { adapterTypeFiles } from '../../../templates/development-tooling/adapterTypes';
import { browserTestFiles } from '../../../templates/development-tooling/browserTest';
import { modelFiles, type AdapterName } from '../../../templates/development-tooling/model';
import { pieceFiles, type PieceKind } from '../../../templates/development-tooling/pieces';
import {
	isAppOnlyScaffold,
	scaffoldDetails,
	scaffoldKinds
} from '../../../templates/development-tooling/scaffoldTypes';
import { adapterExportPlan, modelExportPlans, pieceExportPlans } from './exportPlans';
import { groupedFiles, groupedExports, assertUniqueGroupedNames } from './groupedFiles';
import { generationGroup, saveGenerationGroup } from './generationGroup';
import { ModelDependencyService } from '../../../services/development-tooling/ModelDependencyService';
import { separateTypeDeclarations } from '../../../templates/development-tooling/separateTypeDeclarations';
import { atomicComponentFiles } from '../../../templates/development-tooling/atomicComponents';
import { atomLibrary, useAtomLibrary } from './atomLibrary';

export { scaffoldKinds };

export type { PieceKind };

const adapters = ['d1', 'sqlite', 'postgres'] as const;

export async function generateModel(input: GenerateModelInput): Promise<GenerateResult> {
	const root = input.root ?? process.cwd();
	const name = validateCodeName(input.name);
	const adapter = normalizeAdapter(input.adapter);
	const selection = generationGroup(root, input);
	const planned = [
		...adapterTypeFiles(),
		...modelFiles({ name, fields: parseFields(input.rawFields), adapter })
	];
	const { files, paths } = groupedFiles(planned, selection?.group.id);

	assertUniqueGroupedNames(root, selection?.group.id, files);
	await ensureParents(root, files);
	const writes = await writePlannedFiles(root, files, { force: input.force });
	writes.push(...(await saveGenerationGroup(root, selection)));
	if (adapter === 'sqlite') writes.push(...(await new ModelDependencyService().ensure(root)));
	const exportsUpdated = await maybeExport(
		root,
		groupedExports([...modelExportPlans(name), adapterExportPlan(adapter)], paths)
	);

	return { kind: 'model', name, writes, exportsUpdated };
}

export async function generatePiece(input: GeneratePieceInput): Promise<GenerateResult> {
	if (
		input.level &&
		(!['molecule', 'organism'].includes(input.level) || input.kind !== 'component')
	)
		fail('Use --level molecule or organism with the component scaffold.');
	const root = input.root ?? process.cwd();
	const name = validateCodeName(input.name);
	const projectKind = await detectProjectKind(root);
	assertScaffoldEligible(input.kind, projectKind);

	const support = ['e2e', 'resource'].includes(input.kind)
		? browserTestFiles().filter((file) => !existsSync(join(root, file.path)))
		: [];
	const source = !['test', 'e2e', 'feature', 'migration'].includes(input.kind);
	const selection = source ? generationGroup(root, input) : undefined;
	const dimension = projectKind === 'game' ? await detectGameDimension(root) : undefined;
	const planned = pieceFiles(input.kind, name, { dimension, level: input.level });
	const ui = planned.some((file) => file.path.endsWith('.svelte'));
	const library = ui ? atomLibrary(root) : 'src/components/atoms';
	const pieces = useAtomLibrary(planned, library);
	const grouped = groupedFiles(pieces, selection?.group.id);
	const atoms =
		library === 'src/components/atoms' &&
		['component', 'view', 'layout', 'partial', 'resource'].includes(input.kind)
			? atomicComponentFiles().filter((file) => !existsSync(join(root, file.path)))
			: [];
	const files = separateTypeDeclarations([...grouped.files, ...support, ...atoms]);
	assertUniqueGroupedNames(root, selection?.group.id, files);
	await ensureParents(root, files);
	const writes = await writePlannedFiles(root, files, { force: input.force });
	writes.push(...(await saveGenerationGroup(root, selection)));
	if (input.kind === 'resource') writes.push(...(await new ModelDependencyService().ensure(root)));
	const exportsUpdated =
		projectKind === 'lib'
			? await maybeExport(root, groupedExports(pieceExportPlans(input.kind, name), grouped.paths))
			: false;

	return { kind: input.kind, name, writes, exportsUpdated };
}

/** Game scaffolds need a game project; app scaffolds also serve games, which are app projects. */
function assertScaffoldEligible(kind: PieceKind, projectKind: string): void {
	if (scaffoldDetails[kind].gameOnly && projectKind !== 'game') {
		fail('Game scaffolds require a Harness game project.');
	}

	if (isAppOnlyScaffold(kind) && !['app', 'game'].includes(projectKind)) {
		fail(`The ${kind} scaffold is only available in Harness app projects.`);
	}
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

export type { GenerateModelInput, GeneratePieceInput, GenerateResult } from './generateCode.types';
