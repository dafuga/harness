// @harness-uid u_7u5aguih6c
import type { ProjectKind } from '../../../templates/projects-sessions/project';
import type { FileWriteResult } from '../../../core/development-tooling/files';

export interface CreateProjectInput {
	kind: ProjectKind;
	name: string;
	force?: boolean;
	parent?: string;
	dimension?: '2d' | '3d';
	adapter?: string;
	engine?: string;
}

export interface CreateProjectResult {
	kind: ProjectKind;
	name: string;
	writes: FileWriteResult[];
}
