import { PlanningContext, planRecord } from '../../utils/planning-reads/planningReads';
import type { PlanImageQuery } from "../../models/PlanningPort.types.ts";
import { messageInfo } from "../../utils/planningConvert";

export async function planningReads(context: PlanningContext, revision: string) {
	const snapshot = await context.api.snapshot({ revision });
	if (snapshot.rejected.length)
		throw new Error(snapshot.rejected.map((p) => p.path + ': ' + p.message).join('\n'));
	return Promise.all(snapshot.plans.map((p) => planRecord(context, p, revision)));
}

export async function readPlanMessages(
	context: PlanningContext,
	data: { entityId: string; threadId: string; revision: string }
) {
	const plan = await context.api.readPlan({ unitId: data.entityId, revision: data.revision }),
		thread = plan.threads.find((t) => t.id === data.threadId);
	if (!thread) throw new Error('Thread does not belong to this entity.');
	return thread.messages.map(messageInfo);
}

export async function readPlanImage(context: PlanningContext, query: PlanImageQuery) {
	const plan = await context.api.readPlan({ unitId: query.entityId, revision: query.revision });
	const image = plan.versions
		.find((v) => v.version === query.version)
		?.images.find((i) => i.sha256 === query.sha256);
	if (!image) throw new Error('Image is not part of this entity/version.');
	return (
		await context.api.readImage({
			unitId: query.entityId,
			version: query.version,
			file: image.file,
			sha256: query.sha256,
			option: query.option,
			revision: query.revision
		})
	).bytes;
}

export async function readPlanHistory(
	context: PlanningContext,
	entityId: string,
	revision: string
) {
	const history = await context.api.entityHistory({ unitId: entityId, revision });
	return history.entries.map((entry) => ({
		id: entry.commit,
		at: entry.committedAt,
		kind: 'commit' as const,
		title: entry.subject,
		detail: entry.events.map((e) => e.kind).join(', '),
		commit: entry.commit,
		version: null
	}));
}
