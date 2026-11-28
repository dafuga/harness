// @harness-uid u_kg5hqe6qrs
import { ProjectAssistantError } from '../../core/agents-providers/ProjectAssistantError';
import type { TrackerCliAdapterConfig, TrackerItemView } from './TrackerCliAdapter.types';

const itemId = /^[a-z0-9]{6,12}$/;
const maxTitle = 240;

/** Project-scoped tracker access through the local CLI. Only list, show, add and launch exist. */
export class TrackerCliAdapter {
	constructor(private readonly config: TrackerCliAdapterConfig) {
		if (!/^[a-z0-9][a-z0-9_-]{0,63}$/.test(config.agent))
			throw new ProjectAssistantError('Invalid tracker agent.');
	}

	async list(status?: string): Promise<TrackerItemView[]> {
		const raw = await this.json(['list', '--agent', this.config.agent, '--json']);
		return rows(raw)
			.filter((row) => this.inScope(row) && (!status || row.status === status))
			.map(view);
	}

	async show(id: string): Promise<TrackerItemView> {
		if (!itemId.test(id)) throw new ProjectAssistantError('Invalid tracker item id.');
		const row = rows(await this.json(['show', id, '--json']))[0];
		if (!row || !this.inScope(row))
			throw new ProjectAssistantError('That tracker item is outside this project.');
		return view(row);
	}

	async add(title: string, note: string): Promise<{ id: string }> {
		const clean = title.replace(/\s+/g, ' ').trim().slice(0, maxTitle);
		if (!clean) throw new ProjectAssistantError('A tracker item needs a title.');
		const text = note ? `${clean}\n\n${note.slice(0, 2000)}` : clean;
		const args = [
			'add',
			text,
			'--owner',
			this.config.owner,
			'--agent',
			this.config.agent,
			'--json'
		];
		const created = rows(await this.json(args))[0];
		if (!created || typeof created.id !== 'string')
			throw new ProjectAssistantError('Tracker add gave no id.');
		return { id: created.id.slice(0, 6) };
	}

	async launch(id: string): Promise<void> {
		await this.show(id);
		await this.config.run(['launch', id]);
	}

	private inScope(row: Record<string, unknown>): boolean {
		return row.agent === this.config.agent && row.sensitive !== true;
	}

	private async json(args: readonly string[]): Promise<unknown> {
		const out = await this.config.run(args);
		try {
			return JSON.parse(out);
		} catch {
			throw new ProjectAssistantError('Tracker returned unreadable output.');
		}
	}
}

function rows(raw: unknown): Record<string, unknown>[] {
	const list = Array.isArray(raw) ? raw : [raw];
	return list.filter((row): row is Record<string, unknown> => !!row && typeof row === 'object');
}

function text(value: unknown, max: number): string {
	return typeof value === 'string' ? value.slice(0, max) : '';
}

function view(row: Record<string, unknown>): TrackerItemView {
	const notes = typeof row.notes === 'string' ? row.notes.split('\n').slice(-3) : [];
	return {
		id: text(row.id, 6),
		title: text(row.title, maxTitle),
		status: text(row.status, 20),
		stage: text(row.stage, 20),
		priority: text(row.priority, 20),
		due: typeof row.due === 'string' ? row.due : null,
		owner: text(row.owner, 80),
		notes: notes.map((note) => note.slice(0, 300)),
		runs: rows(row.runs).slice(-5).map(runSummary)
	};
}

function runSummary(run: Record<string, unknown>): string {
	return [run.state, run.outcome, run.started_at, run.ended_at]
		.map((field) => text(field, 25))
		.filter(Boolean)
		.join(' ');
}

export type {
	TrackerCliAdapterConfig,
	TrackerItemView,
	TrackerRunner
} from './TrackerCliAdapter.types';
