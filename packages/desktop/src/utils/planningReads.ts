import type {
	PlanningApi,
	PlanDetail,
	DesignVersion as StoredVersion
} from '../../../planning/src/index';
import type { PlanRecord, PlanImageQuery } from '../models/PlanningPort.types';
import type { DesignRevision, DesignVersion } from '../models/Desktop.types';
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
			bytes: i.bytes,
			...held(version, i.file)
		})),
		approval: approval ? approvalInfo(approval) : null,
		...(await optionInfos(context, revision, directory, version)),
		...(version.revises ? { revises: revisionOf(version.revises) } : {})
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
/** The option holding a file, as a field of its image; nothing in a single design. */
function held(version: StoredVersion, file: string) {
	const option = version.options?.find((o) => o.images.some((i) => i.file === file))?.id;
	return option ? { option } : {};
}
/** The design options of a version with their exact prompts; nothing for a single design. */
async function optionInfos(
	context: PlanningContext,
	revision: string,
	directory: string,
	version: StoredVersion
) {
	if (!version.options) return {};
	const options = await Promise.all(
		version.options.map(async (option) => ({
			id: option.id,
			direction: option.direction,
			prompt: option.prompt
				? await gitText(context.root, revision, directory + option.prompt.file)
				: null,
			revisedPrompt: option.revisedPrompt,
			generator: option.generator.provider + ' · ' + option.generator.model,
			imageHashes: option.images.map((image) => image.sha256)
		}))
	);
	return { options };
}
/** The exact image a version revises, as the desktop names it. */
function revisionOf(source: NonNullable<StoredVersion['revises']>): DesignRevision {
	return {
		version: source.version,
		imageSha256: source.imageSha256,
		region: source.region,
		threadId: source.threadId,
		...(source.option ? { option: source.option } : {})
	};
}
