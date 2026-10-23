import { mkdir, rm } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { GitAdapter } from '../../../../../../src/adapters/git-source-history/GitAdapter';
import { createProject } from '../../../../../../src/cli/program/create-project/createProject';
import { validateProjectName } from '../../../../../../src/cli/program/create-project/validation';
import { GameDocumentRepository } from '../../../../../game/src/repositories/game-authoring/GameDocumentRepository';
import type { DesktopBridge } from '../../../models/development-tooling/DesktopBridge.types';
import type { ProjectSessionService } from '../../../services/projects-sessions/project-session-service/ProjectSessionService';

export class GameProjectService {
	constructor(
		private session: ProjectSessionService,
		private projectsRoot = join(homedir(), 'projects')
	) {}
	async create(input: Parameters<NonNullable<DesktopBridge['gameCreate']>>[0]) {
		if (this.session.busy || this.session.pending)
			throw new Error('Wait for the current project operation.');
		validateProjectName(input.name);
		const parent = this.projectsRoot,
			target = join(parent, input.name);
		await mkdir(parent, { recursive: true });
		await mkdir(target).catch((error: NodeJS.ErrnoException) => {
			if (error.code === 'EEXIST') throw new Error('A project with that name already exists.');
			throw error;
		});
		try {
			await createProject({ ...input, parent });
			if (input.kind === 'game') await initializePlanning(target);
			await initialize(new GitAdapter(target), input.kind);
		} catch (error) {
			// Only this call created the target, so a failed attempt leaves nothing to block a retry.
			await rm(target, { recursive: true, force: true });
			throw error;
		}
		return this.session.open(target);
	}
	async read(input: Parameters<NonNullable<DesktopBridge['gameRead']>>[0]) {
		this.session.assertProject(input.projectId);
		const { root } = this.session.requireProject();
		return new GameDocumentRepository(root).read(input.commit);
	}
	async save(input: Parameters<NonNullable<DesktopBridge['gameSave']>>[0]) {
		this.session.assertProject(input.projectId);
		const { root } = await this.session.mutable();
		if (this.session.busy) throw new Error('Wait for the current run.');
		return this.session.arbiter.exclusive(root, () =>
			new GameDocumentRepository(root).save(input.document, input.expectedRevision)
		);
	}
}

/** Commits with the author Git already resolves for the user; a missing identity fails as Git reports it. */
async function initialize(git: GitAdapter, kind: string) {
	await git.run(['init', '-b', 'main']);
	await git.run(['add', '.']);
	await git.run(['commit', '-m', 'feat: initialize ' + kind + ' project']);
}

async function initializePlanning(root: string) {
	const repository = new GameDocumentRepository(root),
		saved = await repository.read();
	const document = {
		...saved.document,
		views: saved.document.views.map((view) => ({
			...view,
			checkpoints: [],
			planning: { concept: '', description: '' }
		}))
	};
	await repository.save(document, saved.revision);
}
