import { realpath } from 'node:fs/promises';
import { basename } from 'node:path';
import { createHash } from 'node:crypto';
import { LocalDocumentAdapter } from '../adapters/LocalDocumentAdapter';
import { gitRead } from '../utils/gitRead';
import type { DesktopProject } from '../models/ProjectContext.types';
export class ProjectRegistryService {
	private document: LocalDocumentAdapter<DesktopProject[]>;
	constructor(file?: string) {
		this.document = new LocalDocumentAdapter(file, () => []);
	}
	async register(directory: string): Promise<DesktopProject> {
		const root = await realpath(
			(await gitRead(directory, ['rev-parse', '--show-toplevel'])).trim()
		);
		const id = 'local-' + createHash('sha256').update(root).digest('hex');
		return this.document.update((projects) => {
			const existing = projects.find((project) => project.id === id);
			if (existing) return existing;
			const project: DesktopProject = { id, name: basename(root), kind: 'local', root };
			projects.push(project);
			return project;
		});
	}
	async list(): Promise<DesktopProject[]> {
		const projects = await this.document.read();
		if (
			!Array.isArray(projects) ||
			projects.some(
				(project) =>
					project.kind !== 'local' ||
					typeof project.root !== 'string' ||
					!/^local-[a-f0-9]{64}$/.test(project.id)
			)
		)
			throw new Error('Invalid project registry.');
		return projects;
	}
	async get(id: string): Promise<DesktopProject> {
		const project = (await this.list()).find((item) => item.id === id);
		if (!project) throw new Error('Unknown project.');
		return project;
	}
}
