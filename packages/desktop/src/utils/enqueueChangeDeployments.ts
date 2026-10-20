import type { DeploymentEnvironment, DeploymentReceipt } from '../models/Deployment.types';
import type { DeploymentOptions } from '../services/DeploymentService';
import type { DeploymentActivityService } from '../services/DeploymentActivityService';
import { changeEnvironment } from './changeEnvironment';
import { reviewDeployment } from './reviewDeployment';
import { deploymentExecution } from './deploymentExecution';
/** Dependencies retain their exact lower receipt even when newer commits deploy alongside them. */
export async function enqueueChangeDeployments(
	root: string,
	input: { environment: DeploymentEnvironment; commit: string; projectId: string | null },
	runtime: Required<Pick<DeploymentOptions, 'plugin'>> &
		DeploymentOptions & { activities: DeploymentActivityService }
) {
	const reviews = await Promise.all(
		changeEnvironment(input.environment).map((environment) =>
			reviewDeployment(
				root,
				{ environment, commit: input.commit },
				{ plugin: runtime.plugin, projectId: input.projectId, queuedChange: true }
			)
		)
	);
	for (const reviewed of reviews)
		if (reviewed.plan.blockers.length) throw new Error(reviewed.plan.blockers.join(' '));
	runtime.activities.ensureCapacity(reviews.length);
	let dependency: Promise<DeploymentReceipt> | undefined;
	return reviews.map((reviewed) => {
		const activity = runtime.activities.schedule(
			reviewed,
			(update, predecessor) =>
				deploymentExecution(
					{ ...reviewed, predecessor: predecessor ?? reviewed.predecessor },
					{ ...runtime, update }
				),
			dependency
		);
		dependency = runtime.activities.wait(activity.id);
		void dependency.catch(() => undefined);
		return activity;
	});
}
