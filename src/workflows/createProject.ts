import {
	ensureParents,
	renderFileList,
	writePlannedFiles,
	type FileWriteResult
} from '../core/files';
import { validateProjectName } from '../core/validation';
import { projectFiles, type ProjectKind } from '../templates/project';

export type { ProjectKind } from '../templates/project';

export interface CreateProjectInput {
	kind: ProjectKind;
	name: string;
	force?: boolean;
}

export interface CreateProjectResult {
	kind: ProjectKind;
	name: string;
	writes: FileWriteResult[];
}

export async function createProject(input: CreateProjectInput): Promise<CreateProjectResult> {
	const name = validateProjectName(input.name);
	const files = projectFiles({ kind: input.kind, name });

	await ensureParents(name, files);
	const writes = await writePlannedFiles(name, files, { force: input.force });

	return { kind: input.kind, name, writes };
}

export function renderCreateProject(result: CreateProjectResult): string {
	return `Created ${result.kind} harness "${result.name}".\n${renderFileList(result.writes)}`;
}
