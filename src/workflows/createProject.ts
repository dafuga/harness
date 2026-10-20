import {
	ensureParents,
	renderFileList,
	writePlannedFiles,
	type FileWriteResult
} from '../core/files';
import { validateProjectName } from '../core/validation';
import { join } from 'node:path';
import { projectFiles, type ProjectKind } from '../templates/project';

export type { ProjectKind } from '../templates/project';

export interface CreateProjectInput {
	kind: ProjectKind;
	name: string;
	force?: boolean;
	parent?: string;
	dimension?: '2d' | '3d';
}

export interface CreateProjectResult {
	kind: ProjectKind;
	name: string;
	writes: FileWriteResult[];
}

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
