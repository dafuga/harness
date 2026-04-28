import { Command } from 'commander';
import { findGuide, guides } from '../guides/guide';
import { renderGuide } from '../guides/render';

export function registerInfoCommand(program: Command): void {
	program
		.command('info <topic>')
		.option('--json', 'Print structured guidance for agents.')
		.description('Show static Frame guidance for adding code.')
		.action((topic: string, options: { json?: boolean }) => showInfo(topic, options));
}

function showInfo(topic: string, options: { json?: boolean }): void {
	const guide = findGuide(topic);

	if (!guide) {
		const topics = guides.map((entry) => entry.topic).join(', ');
		throw new Error(`Unknown info topic "${topic}". Use one of: ${topics}.`);
	}

	if (options.json) {
		console.log(JSON.stringify(guide, null, 2));
		return;
	}

	console.log(renderGuide(guide));
}
