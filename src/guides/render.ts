import type { Guide } from './guide';

export function renderGuide(guide: Guide): string {
	return [
		`# ${guide.topic}`,
		'',
		guide.summary,
		'',
		renderList('Steps', guide.steps),
		renderList('Rules', guide.rules),
		renderList('Anti-patterns', guide.antiPatterns),
		renderList('Example commands', guide.exampleCommands)
	].join('\n');
}

function renderList(title: string, items: string[]): string {
	return [`## ${title}`, ...items.map((item) => `- ${item}`), ''].join('\n');
}
