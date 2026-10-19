import type { Command } from 'commander';
import { createProject, renderCreateProject } from '../workflows/createProject';
import type { ProjectKind } from '../workflows/createProject';

export function registerNewCommand(program: Command): void {
	const command = program.command('new').description('Create a new Harness project.');

	command
		.command('app <name>')
		.option('--force', 'Overwrite files that already exist.')
		.description('Create a SvelteKit app harness.')
		.action((name: string, options: { force?: boolean }) => runCreateProject('app', name, options));

	command
		.command('lib <name>')
		.option('--force', 'Overwrite files that already exist.')
		.description('Create a Bun TypeScript library harness.')
		.action((name: string, options: { force?: boolean }) => runCreateProject('lib', name, options));
}

async function runCreateProject(
	kind: ProjectKind,
	name: string,
	options: { force?: boolean }
): Promise<void> {
	const result = await createProject({ kind, name, force: options.force });
	console.log(renderCreateProject(result));
}
