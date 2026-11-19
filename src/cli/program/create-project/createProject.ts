// @harness-uid u_7u5aguih6c
import type { CreateProjectInput, CreateProjectResult } from './createProject.types';
import {
	ensureParents,
	writePlannedFiles
} from '../../../adapters/development-tooling/planned-files/writePlannedFiles';
import { renderFileList } from '../../../core/development-tooling/renderFileList';
import { validateProjectName } from './validation';
import { join } from 'node:path';
import { projectFiles } from '../../../templates/projects-sessions/project';

export type { ProjectKind } from '../../../templates/projects-sessions/project';

export async function createProject(input: CreateProjectInput): Promise<CreateProjectResult> {
	const name = validateProjectName(input.name);
	if (input.dimension && !['2d', '3d'].includes(input.dimension))
		throw new Error('Dimension must be 2d or 3d.');
	if (input.engine && !['sveltekit', 'godot'].includes(input.engine))
		throw new Error('Engine must be sveltekit or godot.');
	const files = projectFiles({
		kind: input.kind,
		name,
		dimension: input.dimension,
		engine: input.engine
	});

	const directory = input.parent ? join(input.parent, name) : name;
	await ensureParents(directory, files);
	const writes = await writePlannedFiles(directory, files, { force: input.force });

	return { kind: input.kind, name, writes };
}

export function renderCreateProject(result: CreateProjectResult): string {
	return `Created ${result.kind} harness "${result.name}".\n${renderFileList(result.writes)}`;
}

export type { CreateProjectInput, CreateProjectResult } from './createProject.types';
