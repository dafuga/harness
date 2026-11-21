import type { Command } from 'commander';
import type { RunHarborSdkTool, ScaffoldArguments } from './HarborInspectionCommand.types';

// Adds SDK app-development commands to the existing `harbor` group; the SDK owns all bundle logic.
export function registerHarborAppTools(harbor: Command, run: RunHarborSdkTool): void {
	harbor
		.command('templates')
		.description('List Harbor SDK app templates.')
		.action(() => run(['templates'], 'tool'));
	harbor
		.command('scaffold <template> <dir> [id] [name]')
		.description('Create a Harbor app from an SDK template.')
		.option('--mobile', 'Include the mobile target.')
		.action((...[template, dir, id, name, options]: ScaffoldArguments) => {
			const fields = [template, dir];
			if (id !== undefined) fields.push(id);
			if (name !== undefined) fields.push(name);
			const flags = options.mobile ? ['--mobile'] : [];
			const args = fields.some((field) => field.startsWith('-'))
				? [...flags, '--', ...fields]
				: [...fields, ...flags];
			return run(['scaffold', ...args], 'scaffold');
		});
	harbor
		.command('check [dir]')
		.description('Check a Harbor app with the installed SDK.')
		.action((dir: string | undefined) =>
			run(['check', ...(dir === undefined ? [] : [dir])], 'tool')
		);
	harbor
		.command('pack [dir] [output]')
		.description('Pack a Harbor app with the installed SDK.')
		.action((dir: string | undefined, output: string | undefined) => {
			const args = ['pack'];
			if (dir !== undefined) args.push(dir);
			if (output !== undefined) args.push(output);
			return run(args, 'tool');
		});
	harbor
		.command('stage-android <bundle> <dir>')
		.description('Stage a packed Harbor app for Android with the installed SDK.')
		.action((bundle: string, dir: string) => run(['stage-android', bundle, dir], 'tool'));
}
