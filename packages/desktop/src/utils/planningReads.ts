import type {
	PlanningApi,
	PlanDetail,
	DesignVersion as StoredVersion
} from '../../../planning/src/index';
import type { PlanRecord, PlanImageQuery } from '../models/PlanningPort.types';
import type { DesignVersion } from '../models/Desktop.types';
import { approvalInfo, messageInfo, planningConvert, threadInfo } from './planningConvert';
import { gitText } from './gitRead';
export interface PlanningContext {
	root: string;
	api: PlanningApi;
}
export async function planningReads(context: PlanningContext, revision: string) {
	const snapshot = await context.api.snapshot({ revision });
	if (snapshot.rejected.length)
		throw new Error(snapshot.rejected.map((p) => p.path + ': ' + p.message).join('\n'));
	return Promise.all(snapshot.plans.map((p) => planRecord(context, p, revision)));
}
export async function planRecord(
	context: PlanningContext,
	plan: PlanDetail,
	revision: string
): Promise<PlanRecord> {
	return {
		id: plan.unitId,
		path: plan.path,
		category: (plan.category + 's') as PlanRecord['category'],
		title: plan.title,
		goal: plan.goal,
		lifecycle: plan.lifecycle,
		contract: planningConvert(plan),
		versions: await Promise.all(
			plan.versions.map((v) => planVersion(context, { version: v, plan, revision }))
		),
		threads: plan.threads.map(threadInfo)
	};
}
export async function planVersion(
	context: PlanningContext,
	data: { version: StoredVersion; plan: PlanDetail; revision: string }
): Promise<DesignVersion> {
	const { version, plan, revision } = data,
		approval = plan.approvals.filter((a) => a.version === version.version).at(-1);
	const directory = plan.path + '/designs/' + version.version + '/';
	return {
		version: version.version,
		createdAt: version.createdAt,
		commit: version.commit,
		generator: version.generator.provider + ' · ' + version.generator.model,
		prompt: await gitText(context.root, revision, directory + version.prompt.file),
		baseRevision: version.baseRevision,
		notes: version.notes
			? await gitText(context.root, revision, directory + version.notes.file)
			: undefined,
		images: version.images.map((i) => ({
			state: i.state,
			viewport: i.viewport,
			sha256: i.sha256,
			bytes: i.bytes
		})),
		approval: approval ? approvalInfo(approval) : null
	};
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
