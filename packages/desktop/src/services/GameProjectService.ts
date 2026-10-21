import { mkdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createProject } from '../../../../src/workflows/create-project/createProject';
import { validateProjectName } from '../../../../src/workflows/create-project/validation';
import { GameDocumentRepository } from '../../../game/src/repositories/GameDocumentRepository';
import type { DesktopBridge } from '../models/DesktopBridge.types';
import type { ProjectSessionService } from './ProjectSessionService';

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
		try {
			await mkdir(target);
		} catch {
			throw new Error('A project with that name already exists.');
		}
		await createProject({ ...input, parent });
		execFileSync('git', ['init', '-b', 'main'], { cwd: target, stdio: 'pipe' });
		execFileSync('git', ['add', '.'], { cwd: target, stdio: 'pipe' });
		execFileSync('git', ['commit', '-m', 'feat: initialize ' + input.kind + ' project'], {
			cwd: target,
			stdio: 'pipe'
		});
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
