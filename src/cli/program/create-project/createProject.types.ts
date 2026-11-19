// @harness-uid u_7u5aguih6c
import type { GameEngine, ProjectKind } from '../../../templates/projects-sessions/project.types';
import type { FileWriteResult } from '../../../core/development-tooling/files';

export interface CreateProjectInput {
	kind: ProjectKind;
	name: string;
	force?: boolean;
	parent?: string;
	dimension?: '2d' | '3d';
	engine?: GameEngine;
}

export interface CreateProjectResult {
	kind: ProjectKind;
	name: string;
	writes: FileWriteResult[];
}
