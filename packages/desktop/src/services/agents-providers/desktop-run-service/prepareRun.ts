import { prepareChangeEnvironment } from '../../../utils/promoteChange';
import type { Preparation } from '../../../utils/agents-providers/prepareRun';
import { imageModel, messageFor } from '../../../utils/agents-providers/prepareRun';
import { randomUUID } from 'node:crypto';
import type { RunRequest } from '../../../models/development-tooling/DesktopBridge.types';
import type { RunContext } from '../../../models/development-tooling/RunContext.types';
import { RunCancelled } from '../../../models/agents-providers/AgentRunner.types';
import { approvalMatch } from './approvalMatch';

export async function prepareRun(
	preparation: Preparation,
	request: RunRequest,
	controller: AbortController
): Promise<RunContext> {
	await prepareChangeEnvironment(preparation.session, request);
	const project = await preparation.session.mutable(),
		entity = await project.catalog.entity(request.entityId, project.revision.commit);
	const runner = await preparation.providers.select(
		request.provider,
		request.model,
		request.effort
	);
	if (!entity.threads.some((t) => t.id === request.threadId))
		throw new Error('Thread does not belong to this entity.');
	approvalMatch(entity, request);
	const context: RunContext = {
		...project,
		...preparation,
		id: randomUUID(),
		request,
		entity,
		runner,
		imageModel: await imageModel(preparation, request, entity.category),
		signal: controller.signal
	};
	/* Cancelled or revoked while it was prepared: nothing is written and no CLI starts. */
	if (controller.signal.aborted) throw new RunCancelled();
	await project.planning.appendMessage(messageFor(context, 'user', request.text));
	return context;
}
