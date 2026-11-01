import type {
	DeploymentActivity,
	DeploymentReceipt
} from '../../models/development-tooling/Deployment.types';
import type { DeploymentFact } from './deploymentFacts.types';
/** @pure Full deployment identity followed by the timestamps actually present. */
export function deploymentFacts(deployment: DeploymentActivity): DeploymentFact[] {
	const rows: DeploymentFact[] = [
		{ name: 'Project', value: deployment.projectName, format: 'text' },
		{ name: 'Branch', value: deployment.branch, format: 'code' },
		{ name: 'Commit', value: deployment.commit, format: 'code' }
	];
	const started = deployment.startedAt;
	const queued = started ?? deployment.createdAt;
	if (queued) rows.push({ name: started ? 'Started' : 'Queued', value: queued, format: 'time' });
	const finished = deployment.finishedAt;
	if (finished) rows.push({ name: 'Finished', value: finished, format: 'time' });
	return rows;
}
/** @pure A verified receipt keeps its deployment identity and verified timestamp. */
export function receiptFacts(receipt: DeploymentReceipt): DeploymentFact[] {
	const rows: DeploymentFact[] = [
		{ name: 'Deployment', value: receipt.deploymentId, format: 'code' },
		{ name: 'Address', value: receipt.url, format: 'text' }
	];
	const verified = receipt.updatedAt;
	if (verified) rows.push({ name: 'Verified', value: verified, format: 'time' });
	return rows;
}
