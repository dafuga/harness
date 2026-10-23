import type { Entry, Work } from './DeploymentActivityService.types';
import { basename } from 'node:path';
import { deploymentSteps } from '../../models/development-tooling/Deployment.types';
import type {
	DeploymentActivity,
	DeploymentProgress,
	DeploymentReceipt,
	DeploymentStep
} from '../../models/development-tooling/Deployment.types';
import type { ReviewedDeployment } from './DeploymentService';
/** Host-wide jobs outlive their requesting window. Only equal provider targets share a queue. */
export class DeploymentActivityService {
	private entries = new Map<string, Entry>();
	private tails = new Map<string, Promise<unknown>>();
	list() {
		return [...this.entries.values()].map((entry) => structuredClone(entry.activity)).reverse();
	}
	progress(id: string, root: string) {
		const entry = this.entries.get(id);
		return entry?.root === root ? structuredClone(entry.activity) : null;
	}
	wait(id: string) {
		const entry = this.entries.get(id);
		return entry?.completion ?? Promise.reject(new Error('Unknown deployment.'));
	}
	async idle() {
		await Promise.allSettled([...this.entries.values()].map((entry) => entry.completion));
	}
	ensureCapacity(count = 1) {
		if (
			[...this.entries.values()].filter((entry) => !entry.activity.finishedAt).length + count >
			128
		)
			throw new Error('Wait for queued deployments before starting more.');
	}
	schedule(reviewed: ReviewedDeployment, work: Work, dependency?: Promise<DeploymentReceipt>) {
		this.ensureCapacity();
		if (this.entries.has(reviewed.plan.id)) throw new Error('This deployment already started.');
		const key = targetKey(reviewed),
			activity = activityFor(reviewed);
		const completion = (this.tails.get(key) ?? Promise.resolve())
			.then(async () => {
				const predecessor = await dependency?.catch(() => {
					throw new Error('A required lower-environment deployment failed.');
				});
				return work((phase, detail) => this.update(activity.id, phase, detail), predecessor);
			})
			.then((receipt) => {
				this.update(activity.id, 'complete', `Deployed to ${activity.environment}`, { receipt });
				return receipt;
			})
			.catch((error: unknown) => {
				this.update(activity.id, 'failed', 'Deployment failed', { error });
				throw error;
			});
		const tail = completion.catch(() => undefined);
		this.tails.set(key, tail);
		void tail.then(() => {
			if (this.tails.get(key) === tail) this.tails.delete(key);
		});
		this.entries.set(activity.id, { root: reviewed.root, activity, completion });
		this.prune();
		return structuredClone(activity);
	}
	private update(
		id: string,
		phase: DeploymentProgress['phase'],
		detail: string,
		outcome: { receipt?: DeploymentReceipt; error?: unknown } = {}
	) {
		const item = this.entries.get(id)!.activity,
			now = new Date().toISOString();
		item.phase = phase;
		item.detail = detail;
		item.updatedAt = now;
		if (!['queued', 'complete', 'failed'].includes(phase) && !item.startedAt) item.startedAt = now;
		if (!['queued', 'complete', 'failed'].includes(phase)) item.step = phase as DeploymentStep;
		if (outcome.receipt) item.receipt = outcome.receipt;
		if (phase === 'failed') item.error = failureMessage(item, outcome.error);
		if (phase === 'complete' || phase === 'failed') item.finishedAt = now;
		this.prune();
	}
	private prune() {
		const terminal = [...this.entries]
			.filter(([, entry]) => entry.activity.finishedAt)
			.sort((a, b) => a[1].activity.finishedAt!.localeCompare(b[1].activity.finishedAt!));
		for (const [id] of terminal.slice(0, -64)) this.entries.delete(id);
	}
}
function failureMessage(item: DeploymentActivity, error: unknown) {
	if (error instanceof Error && error.message === 'A required lower-environment deployment failed.')
		return error.message;
	const title = item.steps.find((step) => step.id === item.step)?.title ?? 'Deployment';
	return `${title} failed. Check the project configuration and retry.`;
}
function targetKey(reviewed: ReviewedDeployment) {
	const target = reviewed.target;
	if (!target) throw new Error('Configure the deployment target.');
	return JSON.stringify([
		reviewed.plan.adapter,
		target.kind,
		target.accountId,
		target.name,
		target.kind === 'pages' ? target.branch : ''
	]);
}
function activityFor(reviewed: ReviewedDeployment): DeploymentActivity {
	const now = new Date().toISOString(),
		{ plan } = reviewed;
	return {
		id: plan.id,
		projectId: reviewed.projectId,
		projectName: basename(reviewed.root),
		environment: plan.environment,
		sourceEnvironment: reviewed.sourceEnvironment,
		commit: plan.commit,
		branch: plan.branch,
		steps: deploymentSteps.map((step) => ({ ...step })),
		phase: 'queued',
		step: null,
		detail: `Queued for ${plan.environment}`,
		error: null,
		receipt: null,
		createdAt: now,
		updatedAt: now,
		startedAt: null,
		finishedAt: null
	};
}
export const desktopDeployments = new DeploymentActivityService();
