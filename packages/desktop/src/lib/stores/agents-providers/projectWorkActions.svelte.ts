import type { Workspace } from '../workspace.svelte';
import type { createProjectWorkStore } from './projectWork.svelte';
import type {
	FeaturePlanApproval,
	FeaturePlanSelection
} from '../../../models/DesktopBridge.types';

class ProjectWorkActionsStore {
	private pendingValue = $state(false);
	private errorValue = $state<string | null>(null);
	private scope = $state.raw<{
		projectId: string | null;
		bridge: Workspace['bridge'];
		kind: 'select' | 'approve';
		available: boolean;
	} | null>(null);
	private generation = 0;
	private invalidated = false;

	constructor(
		private readonly workspace: Workspace,
		private readonly work: Pick<ReturnType<typeof createProjectWorkStore>, 'snapshot' | 'refresh'>
	) {}

	get pending() {
		return this.current() && this.pendingValue;
	}
	get error() {
		return this.current() ? this.errorValue : null;
	}
	select(input: Omit<FeaturePlanSelection, 'projectId'>) {
		return this.run('select', input);
	}
	approve(input: Omit<FeaturePlanApproval, 'projectId'>) {
		return this.run('approve', input);
	}

	private available(bridge: Workspace['bridge'], kind: 'select' | 'approve') {
		return (
			typeof (kind === 'select' ? bridge?.selectFeaturePlan : bridge?.approveFeaturePlan) ===
			'function'
		);
	}
	private current() {
		if (!this.scope || this.invalidated) return false;
		const matches =
			this.scope.projectId === this.workspace.projectId &&
			this.scope.bridge === this.workspace.bridge &&
			this.scope.available === this.available(this.workspace.bridge, this.scope.kind);
		if (!matches) this.invalidated = true;
		return matches;
	}
	private active(token: number) {
		return token === this.generation && this.current();
	}

	private ready(input: { feature: string; expectedDigest: string }) {
		const { projectId, bridge, available } = this.scope!;
		if (!projectId || !bridge || !available)
			throw new Error('Feature plan action is unavailable for this project.');
		const plan = this.work.snapshot?.features.find((feature) => feature.id === input.feature)?.plan;
		if (!plan || plan.digest !== input.expectedDigest)
			throw new Error('Review the current feature plan before this action.');
		return { projectId, bridge };
	}

	private async invoke(
		kind: 'select' | 'approve',
		input: Omit<FeaturePlanSelection, 'projectId'> | Omit<FeaturePlanApproval, 'projectId'>,
		bridge: NonNullable<Workspace['bridge']>,
		projectId: string
	) {
		if (kind === 'select') {
			const selection = input as Omit<FeaturePlanSelection, 'projectId'>;
			await bridge.selectFeaturePlan!.call(bridge, {
				projectId,
				feature: selection.feature,
				page: selection.page,
				option: selection.option,
				expectedDigest: selection.expectedDigest
			});
		} else {
			const approval = input as Omit<FeaturePlanApproval, 'projectId'>;
			await bridge.approveFeaturePlan!.call(bridge, {
				projectId,
				feature: approval.feature,
				reviewer: approval.reviewer,
				expectedDigest: approval.expectedDigest
			});
		}
	}

	private async run(
		kind: 'select' | 'approve',
		input: Omit<FeaturePlanSelection, 'projectId'> | Omit<FeaturePlanApproval, 'projectId'>
	): Promise<boolean> {
		if (this.pendingValue && this.current()) return false;
		const projectId = this.workspace.projectId;
		const bridge = this.workspace.bridge;
		const token = ++this.generation;
		this.scope = { projectId, bridge, kind, available: this.available(bridge, kind) };
		this.invalidated = false;
		this.errorValue = null;
		this.pendingValue = true;
		try {
			const ready = this.ready(input);
			await this.invoke(kind, input, ready.bridge, ready.projectId);
			if (!this.active(token)) return false;
			await this.work.refresh();
			return this.active(token);
		} catch (failure) {
			if (this.active(token))
				this.errorValue =
					failure instanceof Error && failure.message
						? failure.message
						: 'Feature plan action failed.';
			return false;
		} finally {
			if (token === this.generation) this.pendingValue = false;
		}
	}
}

export function createProjectWorkActionsStore(
	workspace: Workspace,
	work: Pick<ReturnType<typeof createProjectWorkStore>, 'snapshot' | 'refresh'>
) {
	return new ProjectWorkActionsStore(workspace, work);
}
