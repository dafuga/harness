import type { Command } from 'commander';
import { createProject, renderCreateProject } from './create-project/createProject';
import type { ProjectKind } from './create-project/createProject';

export function registerNewCommand(program: Command): void {
	const command = program.command('new').description('Create a new Harness project.');

	command
		.command('app <name>')
		.option('--force', 'Overwrite files that already exist.')
		.description('Create a SvelteKit app harness.')
		.action((name: string, options: { force?: boolean }) => runCreateProject('app', name, options));

	command
		.command('game <name>')
		.option('--force', 'Overwrite existing files.')
		.option('--dimension <dimension>', '2d or 3d.', '2d')
		.description('Create a game with independent views, mechanics and checkpoints.')
		.action((name: string, options: { force?: boolean; dimension: '2d' | '3d' }) =>
			runCreateProject('game', name, options)
		);

	command
		.command('lib <name>')
		.option('--force', 'Overwrite files that already exist.')
		.description('Create a Bun TypeScript library harness.')
		.action((name: string, options: { force?: boolean }) => runCreateProject('lib', name, options));
}

async function runCreateProject(
	kind: ProjectKind,
	name: string,
	options: { force?: boolean; dimension?: '2d' | '3d' }
): Promise<void> {
	const result = await createProject({
		kind,
		name,
		force: options.force,
		dimension: options.dimension
	});
	console.log(renderCreateProject(result));
}
