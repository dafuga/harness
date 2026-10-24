import type { AgentEntry } from '../../../../../../src/core/activityTypes';
import { activityReading } from '../../../../../reports/src/utils/projects-sessions/activityReading';
import type { Workspace } from '../projects-sessions/workspace.svelte';

import type { Sample } from './agentRoster.svelte.types';

/** A project-scoped live reading, independent of the historical revision being browsed. */
class AgentRosterState {
	private stored = $state.raw<Sample | null>(null);
	private project = $state<string | null>(null);
	private now = $state(Date.now());
	loading = $state(false);
	error = $state('');
	private active = true;
	private generation = 0;
	constructor(private readonly workspace: Workspace) {}
	get sample() {
		return this.project === this.workspace.projectId ? this.stored : null;
	}
	private get reading() {
		return this.sample && activityReading(this.sample.agents, this.sample.sampledAt, this.now);
	}
	get working() {
		return this.reading?.working ?? null;
	}
	get sessions() {
		return (
			this.sample?.agents.roster.map((agent) => ({ agent, label: this.reading!.label(agent) })) ??
			[]
		);
	}
	get modules() {
		const assignments = new Map<string, AgentEntry[]>();
		for (const agent of this.sample?.agents.roster ?? []) {
			if (this.reading?.label(agent) !== 'Working') continue;
			for (const id of new Set(agent.units)) {
				const owners = assignments.get(id) ?? [];
				owners.push(agent);
				assignments.set(id, owners);
			}
		}
		return [...assignments].map(([id, owners]) => ({ id, owners }));
	}
	refresh = async () => {
		if (!this.active || this.loading) return;
		const projectId = this.workspace.projectId;
		const reader = this.workspace.bridge?.agentActivity;
		if (!projectId || !reader) {
			this.error = unavailable;
			return;
		}
		const token = this.generation;
		this.loading = true;
		try {
			const value = await reader({ projectId });
			if (this.owns(token, projectId)) {
				this.project = projectId;
				this.stored = value;
				this.now = Date.now();
				this.error = '';
			}
		} catch {
			if (this.owns(token, projectId))
				this.error = this.sample ? 'Could not refresh. Showing the last reading.' : unavailable;
		} finally {
			if (this.active && token === this.generation) this.loading = false;
		}
	};
	private owns(token: number, projectId: string) {
		return this.active && token === this.generation && projectId === this.workspace.projectId;
	}
	listen() {
		this.active = true;
		const visible = () => {
			this.now = Date.now();
			if (document.visibilityState === 'visible') void this.refresh();
		};
		const timer = setInterval(visible, 15_000);
		document.addEventListener('visibilitychange', visible);
		void this.refresh();
		return () => {
			this.active = false;
			this.generation++;
			clearInterval(timer);
			document.removeEventListener('visibilitychange', visible);
		};
	}
}
const unavailable = 'Live agent activity is unavailable for this project.';

export function createAgentRosterStore(workspace: Workspace) {
	return new AgentRosterState(workspace);
}
