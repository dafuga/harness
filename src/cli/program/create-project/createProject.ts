import type { CreateProjectInput, CreateProjectResult } from './createProject.types';
import {
	ensureParents,
	renderFileList,
	writePlannedFiles
} from '../../../core/development-tooling/files';
import { validateProjectName } from './validation';
import { join } from 'node:path';
import { projectFiles } from '../../../templates/projects-sessions/project';

export type { ProjectKind } from '../../../templates/projects-sessions/project';

export async function createProject(input: CreateProjectInput): Promise<CreateProjectResult> {
	const name = validateProjectName(input.name);
	if (input.dimension && !['2d', '3d'].includes(input.dimension))
		throw new Error('Dimension must be 2d or 3d.');
	const files = projectFiles({ kind: input.kind, name, dimension: input.dimension });

	const directory = input.parent ? join(input.parent, name) : name;
	await ensureParents(directory, files);
	const writes = await writePlannedFiles(directory, files, { force: input.force });

	return { kind: input.kind, name, writes };
}

export function renderCreateProject(result: CreateProjectResult): string {
	return `Created ${result.kind} harness "${result.name}".\n${renderFileList(result.writes)}`;
}

export type { CreateProjectInput, CreateProjectResult } from './createProject.types';
