import type { FeatureWorkSnapshot } from '../../../../../../src/services/agents-providers/FeatureWorkService.types';
import type { Workspace } from '../workspace.svelte';

function workError(error: unknown) {
	return error instanceof Error && error.message
		? error.message
		: 'Feature work could not be loaded.';
}

class ProjectWorkStore {
	private data = $state<FeatureWorkSnapshot | null>(null);
	private failure = $state<string | null>(null);
	private pending = $state(false);
	private project = $state<string | null>(null);
	private bridge = $state.raw<Workspace['bridge'] | null>(null);
	private readable = $state(false);
	private generation = 0;
	private stopListening: (() => void) | null = null;

	constructor(private readonly workspace: Workspace) {}

	get snapshot() {
		return this.project && this.readable && this.matchesScope() ? this.data : null;
	}

	get error() {
		return this.matchesScope() ? this.failure : null;
	}

	get loading() {
		return this.matchesScope() && this.pending;
	}

	private matchesScope() {
		return (
			this.project === this.workspace.projectId &&
			this.bridge === this.workspace.bridge &&
			this.readable === (typeof this.workspace.bridge?.projectWork === 'function')
		);
	}

	async refresh(): Promise<void> {
		const generation = ++this.generation;
		const projectId = this.workspace.projectId;
		const bridge = this.workspace.bridge;
		if (!this.matchesScope()) this.data = null;
		this.project = projectId;
		this.bridge = bridge;
		const reader = bridge?.projectWork;
		this.readable = typeof reader === 'function';
		this.failure = null;
		this.pending = false;
		if (!projectId || typeof reader !== 'function') {
			this.failure = 'Feature work is unavailable for this project.';
			return;
		}
		const current = () => generation === this.generation && this.matchesScope();
		this.pending = true;
		try {
			const snapshot = await reader.call(bridge, { projectId });
			if (current()) this.data = snapshot;
		} catch (error) {
			if (current()) this.failure = workError(error);
		} finally {
			if (current()) this.pending = false;
		}
	}

	listen(): () => void {
		this.stopListening?.();
		let active = true;
		const page = typeof document === 'undefined' ? null : document;
		const refreshVisible = () => {
			if (active && (!page || page.visibilityState === 'visible') && !this.loading)
				void this.refresh();
		};
		refreshVisible();
		const timer = page ? setInterval(refreshVisible, 5000) : null;
		page?.addEventListener('visibilitychange', refreshVisible);
		const stop = () => {
			if (!active) return;
			active = false;
			if (timer !== null) clearInterval(timer);
			page?.removeEventListener('visibilitychange', refreshVisible);
			++this.generation;
			this.pending = false;
			this.stopListening = null;
		};
		this.stopListening = stop;
		return stop;
	}
}

export function createProjectWorkStore(workspace: Workspace) {
	return new ProjectWorkStore(workspace);
}
