// @harness-uid u_rhteyojncu
import type { Command } from 'commander';
import { readProjectList } from '../../lib/projects-sessions/projects';

export class ProjectListCommand {
	register(program: Command): void {
		program
			.command('projects')
			.description('Read local Harness project cards.')
			.command('list')
			.description('List project titles, states and tracker counts.')
			.option('--json', 'Print the stable project-list JSON.')
			.action((options: { json?: boolean }) => this.run(Boolean(options.json)));
	}

	async run(json: boolean): Promise<void> {
		const result = await readProjectList();
		if (json) {
			console.log(JSON.stringify(result));
			return;
		}
		if (result.status === 'ready') {
			console.log(
				result.projects.map((project) => `${project.title} · ${project.state}`).join('\n')
			);
		} else {
			console.log(
				result.status === 'empty' ? 'No local projects.' : 'Local projects are unavailable.'
			);
		}
	}
}
