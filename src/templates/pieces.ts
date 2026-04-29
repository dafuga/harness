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

export function pieceFiles(kind: PieceKind, name: string): PlannedFile[] {
	if (kind === 'controller') return controllerFiles(name);
	if (kind === 'service') return classFiles('services', name, 'Service');
	if (kind === 'decorator') return classFiles('decorators', name, 'Decorator');
	if (kind === 'component') return componentFiles(name);
	if (kind === 'test') return testFiles(name);
	if (kind === 'feature') return featureFiles(name);
	if (kind === 'migration') return migrationFiles(name);
	if (kind === 'view') return viewFiles(name);
	if (kind === 'layout') return layoutFiles(name);
	if (kind === 'api') return apiFiles(name);
	if (kind === 'store') return storeFiles(name);
	if (kind === 'hook') return hookFiles(name);
	if (kind === 'e2e') return e2eFiles(name);
	if (kind === 'adapter') return adapterFiles(name);
	if (kind === 'repository') return repositoryFiles(name);
	if (kind === 'validator') return validatorFiles(name);
	if (kind === 'serializer') return serializerFiles(name);
	if (kind === 'policy') return policyFiles(name);
	if (kind === 'job') return classFiles('jobs', name, 'Job');
	if (kind === 'notification') return classFiles('notifications', name, 'Notification');
	if (kind === 'seeder') return seederFiles(name);
	if (kind === 'command') return classFiles('commands', name, 'Command');
	return utilFiles(name);
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
