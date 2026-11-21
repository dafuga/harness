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
import type {
	AppAdapter,
	GameEngine,
	ProjectKind
} from '../../../templates/projects-sessions/project.types';
import { fail } from '../../../core/development-tooling/errors';

export type { ProjectKind } from '../../../templates/projects-sessions/project';

export async function createProject(input: CreateProjectInput): Promise<CreateProjectResult> {
	const name = validateProjectName(input.name);
	if (input.dimension && !['2d', '3d'].includes(input.dimension))
		throw new Error('Dimension must be 2d or 3d.');
	const adapter = appAdapter(input.kind, input.adapter);
	const engine = gameEngine(input.kind, input.engine);
	const files = projectFiles({
		kind: input.kind,
		name,
		dimension: input.dimension,
		adapter,
		engine
	});

	const directory = input.parent ? join(input.parent, name) : name;
	await ensureParents(directory, files);
	const writes = await writePlannedFiles(directory, files, { force: input.force });

	return { kind: input.kind, name, writes };
}

function appAdapter(kind: ProjectKind, adapter?: string): AppAdapter | undefined {
	if (adapter === undefined) return undefined;
	if (kind !== 'app') return fail('The SvelteKit adapter is only available for app projects.');
	if (adapter === 'auto' || adapter === 'static') return adapter;
	return fail('Unsupported app adapter. Use auto or static.');
}

function gameEngine(kind: ProjectKind, engine?: string): GameEngine | undefined {
	if (engine === undefined) return undefined;
	if (kind !== 'game') return fail('The engine is only available for game projects.');
	if (engine === 'sveltekit' || engine === 'godot') return engine;
	return fail('Unsupported game engine. Use sveltekit or godot.');
}

export function renderCreateProject(result: CreateProjectResult): string {
	return `Created ${result.kind} harness "${result.name}".\n${renderFileList(result.writes)}`;
}

export type { CreateProjectInput, CreateProjectResult } from './createProject.types';
