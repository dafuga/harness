import { Preparation, imageModel, messageFor } from '../../utils/prepareRun';
import { randomUUID } from 'node:crypto';
import type { RunRequest } from '../../models/DesktopBridge.types.ts';
import type { RunContext } from '../../models/RunContext.types.ts';
import { RunCancelled } from '../../models/AgentRunner.types.ts';
import { approvalMatch } from './approvalMatch';

export async function prepareRun(
	preparation: Preparation,
	request: RunRequest,
	controller: AbortController
): Promise<RunContext> {
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
