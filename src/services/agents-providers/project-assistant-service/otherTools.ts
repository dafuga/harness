// @harness-uid u_kg5hqk6hij
import type { AssistantToolDefinition } from '../../../core/agents-providers/projectAssistant.types';
import { ProjectAssistantError } from '../../../core/agents-providers/ProjectAssistantError';
import type { GitHubAppAdapter } from '../../../adapters/agents-providers/GitHubAppAdapter';
import type { HealthProbeAdapter } from '../../../adapters/agents-providers/HealthProbeAdapter';
import type { TrackerCliAdapter } from '../../../adapters/agents-providers/TrackerCliAdapter';
import { assistantToolDefinition as define } from './assistantToolDefinition';

const line = (item: {
	id: string;
	title: string;
	status: string;
	stage: string;
	priority: string;
}) => `${item.id} [${item.status}/${item.stage}/${item.priority}] ${item.title}`;

export function trackerReadTools(tracker: TrackerCliAdapter): AssistantToolDefinition[] {
	return [
		define(
			'tracker_list',
			'List this project’s tracker items (roadmap and work in progress), optionally by status.',
			{ fields: { status: 'open|in_progress|blocked|done' } },
			async (input) => {
				const status = typeof input.status === 'string' ? input.status : undefined;
				const items = await tracker.list(status);
				return { text: items.slice(0, 40).map(line).join('\n') || 'No items.', sources: [] };
			}
		),
		define(
			'tracker_show',
			'Read one tracker item of this project and its recent run states by item id.',
			{ fields: { id: 'string' }, required: ['id'] },
			async (input) => {
				const item = await tracker.show(String(input.id ?? ''));
				const head = `${line(item)}\nowner=${item.owner} due=${item.due}`;
				return {
					text: [head, ...item.notes, ...item.runs.map((run) => 'Run: ' + run)].join('\n'),
					sources: []
				};
			}
		)
	];
}

export function healthTool(health: HealthProbeAdapter): AssistantToolDefinition[] {
	const names = health.names();
	return [
		define(
			'health_check',
			`Fetch a configured health URL. Targets: ${names.join(', ')}.`,
			{ fields: { target: names.join('|') || 'string' }, required: ['target'] },
			async (input) => {
				const result = await health.probe(String(input.target ?? ''));
				return {
					text: `${result.name}: HTTP ${result.status} in ${result.latencyMs} ms`,
					sources: [{ label: result.name, url: result.url }]
				};
			}
		)
	];
}

/** The only mutating tools. None deploys, merges or changes a branch. */
export function writeTools(
	github: GitHubAppAdapter,
	tracker: TrackerCliAdapter
): AssistantToolDefinition[] {
	return [
		define(
			'create_github_issue',
			'Create a GitHub issue in the project repository when a writer asks for one.',
			{ fields: { title: 'string', body: 'string' }, required: ['title'], write: true },
			async (input) => {
				const title = String(input.title ?? '')
					.trim()
					.slice(0, 200);
				if (!title) throw new ProjectAssistantError('An issue needs a title.');
				const body = String(input.body ?? '').slice(0, 6000);
				const made = await github.createIssue({ title, body });
				const source = { label: `#${made.number}`, url: made.url };
				return { text: `Created issue #${made.number}`, sources: [source] };
			}
		),
		define(
			'create_tracker_item',
			'Create a tracker item for this project when a writer asks for work to be tracked.',
			{ fields: { title: 'string', notes: 'string' }, required: ['title'], write: true },
			async (input) => {
				const made = await tracker.add(String(input.title ?? ''), String(input.notes ?? ''));
				return { text: `Created tracker item ${made.id}`, sources: [] };
			}
		),
		define(
			'launch_tracker_item',
			'Start a session on an existing tracker item of this project when a writer asks.',
			{ fields: { id: 'string' }, required: ['id'], write: true },
			async (input) => {
				await tracker.launch(String(input.id ?? ''));
				return { text: `Launch requested for ${String(input.id)}`, sources: [] };
			}
		)
	];
}
