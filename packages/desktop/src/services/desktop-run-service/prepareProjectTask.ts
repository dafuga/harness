import type { ProjectTaskContext } from '../../utils/prepareProjectTask';
import { randomUUID } from 'node:crypto';
import type { ProjectTaskRequest } from '../../models/DesktopBridge.types';
import type { Preparation } from '../../utils/prepareRun';
import { prepareChangeEnvironment } from '../../utils/promoteChange';
import { RunCancelled } from '../../models/AgentRunner.types';

/** Rechecks project and revision before selecting a runner. No client can choose its cwd. */
export async function prepareProjectTask(
	preparation: Preparation,
	request: ProjectTaskRequest,
	controller: AbortController
): Promise<ProjectTaskContext> {
	const { session, providers } = preparation;
	session.assertProject(request.projectId);
	await prepareChangeEnvironment(session, request);
	const project = await session.mutable();
	if (project.revision.branch !== request.branch || project.revision.commit !== request.commit)
		throw new Error('The project revision changed. Refresh before asking the agent.');
	const runner = await providers.select(request.provider, request.model, request.effort);
	if (controller.signal.aborted) throw new RunCancelled();
	return {
		...preparation,
		preparation,
		project,
		root: project.root,
		revision: project.revision,
		planning: project.planning,
		id: randomUUID(),
		request,
		runner,
		signal: controller.signal
	};
}
