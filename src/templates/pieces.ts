import { toKebabCase, toPascalCase } from '../core/case';
import type { PlannedFile } from '../core/files';
import {
	apiFiles,
	componentFiles,
	e2eFiles,
	hookFiles,
	layoutFiles,
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
import type { PieceKind } from './scaffoldTypes';

export type { PieceKind } from './scaffoldTypes';

const pieceBuilders: Record<PieceKind, (name: string) => PlannedFile[]> = {
	controller: controllerFiles,
	service: (name) => classFiles('services', name, 'Service'),
	decorator: (name) => classFiles('decorators', name, 'Decorator'),
	component: componentFiles,
	test: testFiles,
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
	util: utilFiles
};

export function pieceFiles(kind: PieceKind, name: string): PlannedFile[] {
	return pieceBuilders[kind](name);
}

function testFiles(name: string): PlannedFile[] {
	const fileName = toKebabCase(name);

	return [
		{
			path: `test/${fileName}.test.ts`,
			contents: `import { expect, test } from 'vitest';\n\ntest('${fileName}', () => {\n\texpect(true).toBe(true);\n});\n`
		}
	];
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
