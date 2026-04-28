import { Command } from 'commander';
import { ensureParents, renderFileList, writePlannedFiles } from '../core/files';
import { projectFiles, type ProjectKind } from '../templates/project';

export function registerNewCommand(program: Command): void {
	const command = program.command('new').description('Create a new Frame project.');

	command
		.command('app <name>')
		.description('Create a SvelteKit app frame.')
		.action((name: string) => createProject('app', name));

	command
		.command('lib <name>')
		.description('Create a Bun TypeScript library frame.')
		.action((name: string) => createProject('lib', name));
}

async function createProject(kind: ProjectKind, name: string): Promise<void> {
	const files = projectFiles({ kind, name });
	await ensureParents(name, files);
	await writePlannedFiles(name, files);
	console.log(`Created ${kind} frame "${name}".\n${renderFileList(files)}`);
}
