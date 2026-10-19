import { randomUUID } from 'node:crypto';
import { RunCancelled } from '../models/AgentRunner.types';
import type { ProjectRunRequest } from '../models/DesktopBridge.types';
import type { RunContext } from '../models/RunContext.types';
import type { ProjectSessionService } from '../services/ProjectSessionService';
import { creationProject } from './ipcPayload';
import type { Preparation } from './prepareRun';

/** A creation run before anything exists: the project, the chosen runner and the request. */
export interface ProjectRunContext extends Omit<RunContext, 'request' | 'entity' | 'imageModel'> {
	request: ProjectRunRequest;
	preparation: Preparation;
	project: Awaited<ReturnType<ProjectSessionService['mutable']>>;
}

/**
 * What a creation run needs before it asks anything: the project it names being the open one,
 * the checked-out branch tip of a writable project, and the runner of exactly the provider, model
 * and effort that were chosen. Nothing is written here, so a refusal leaves no trace.
 */
export async function prepareProjectRun(
	preparation: Preparation,
	request: ProjectRunRequest,
	controller: AbortController
): Promise<ProjectRunContext> {
	if (request.intent !== 'create' || request.mode !== 'plan')
		throw new Error('Something new is asked for as a Plan.');
	// Whatever carried the request here, it names its project, and that is the one that is open.
	preparation.session.assertProject(creationProject(request.projectId));
	const project = await preparation.session.mutable();
	const runner = await preparation.providers.select(
		request.provider,
		request.model,
		request.effort
	);
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
