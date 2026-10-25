import type { PieceContext } from './pieces.types';
import { separateTypeDeclarations } from './separateTypeDeclarations';
import { atomicMarkup } from './atomicMarkup';
import { toKebabCase, toPascalCase } from '../../helpers/strings/case';
import type { PlannedFile } from '../../core/development-tooling/files';
import {
	apiFiles,
	componentFiles,
	e2eFiles,
	hookFiles,
	layoutFiles,
	partialFiles,
	storeFiles,
	viewFiles
} from './appPieces';
import {
	adapterFiles,
	classFiles,
	controllerFiles,
	policyFiles,
	repositoryFiles,
	seederFiles,
	serializerFiles,
	utilFiles,
	validatorFiles
} from './packagePieces';
import {
	channelFiles,
	concernFiles,
	configFiles,
	formFiles,
	helperFiles,
	initializerFiles,
	mailerFiles,
	middlewareFiles,
	resourceFiles
} from './railsPieces';
import type { PieceKind } from './scaffoldTypes';
import { gameViewFiles, mechanicFiles, checkpointFiles } from '../game-authoring/gamePieces';

export type { PieceKind } from './scaffoldTypes';

const pieceBuilders: Record<PieceKind, (name: string, context: PieceContext) => PlannedFile[]> = {
	'game-view': gameViewFiles,
	mechanic: mechanicFiles,
	checkpoint: checkpointFiles,
	controller: controllerFiles,
	service: (name) => classFiles('services', name, 'Service'),
	decorator: (name) => classFiles('decorators', name, 'Decorator'),
	component: componentFiles,
	feature: featureFiles,
	migration: migrationFiles,
	view: viewFiles,
	layout: layoutFiles,
	api: apiFiles,
	store: storeFiles,
	hook: hookFiles,
	e2e: e2eFiles,
	adapter: adapterFiles,
	repository: repositoryFiles,
	validator: validatorFiles,
	serializer: serializerFiles,
	policy: policyFiles,
	job: (name) => classFiles('jobs', name, 'Job'),
	notification: (name) => classFiles('notifications', name, 'Notification'),
	seeder: seederFiles,
	command: (name) => classFiles('commands', name, 'Command'),
	util: utilFiles,
	mailer: mailerFiles,
	helper: helperFiles,
	concern: concernFiles,
	channel: channelFiles,
	resource: resourceFiles,
	form: formFiles,
	partial: partialFiles,
	initializer: initializerFiles,
	config: configFiles,
	middleware: middlewareFiles
};

export function pieceFiles(
	kind: PieceKind,
	name: string,
	context: PieceContext = {}
): PlannedFile[] {
	return separateTypeDeclarations(
		pieceBuilders[kind](name, context).map((file) => ({
			...file,
			contents: file.path.endsWith('.svelte')
				? atomicMarkup(file.contents, file.path, componentLevel(kind, context.level, file.path))
				: file.contents
		}))
	);
}

function featureFiles(name: string): PlannedFile[] {
	const title = toPascalCase(name).replace(/([a-z])([A-Z])/g, '$1 $2');

	return [
		{
			path: `specification/features/planned/${toKebabCase(name)}.md`,
			contents: `# Feature: ${title}\n\n## Overview\n\nDescribe the user-facing outcome.\n\n## Acceptance Criteria\n\n- The feature has a measurable completion gate.\n\n## Future Enhancements\n\n- Capture follow-up ideas outside the current scope.\n`
		}
	];
}

function migrationFiles(name: string): PlannedFile[] {
	return [
		{
			path: `db/migrations/${toKebabCase(name)}.sql`,
			contents: `-- ${name}\n-- Keep migrations small and reversible when the database supports it.\n`
		}
	];
}

export type { PieceContext } from './pieces.types';

function componentLevel(kind: PieceKind, level: PieceContext['level'], path: string) {
	if (path.endsWith('+page.svelte')) return 'page';
	if (kind === 'layout') return 'layout';
	if (['view', 'resource'].includes(kind)) return 'page';
	return level ?? 'molecule';
}
