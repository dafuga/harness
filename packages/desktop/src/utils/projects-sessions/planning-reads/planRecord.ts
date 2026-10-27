import type { PlanningContext } from './planRecord.types';
import type {
	PlanDetail,
	DesignVersion as StoredVersion
} from '../../../../../planning/src/lib/planning/index';
import type { PlanRecord } from '../../../models/planning-collaboration/PlanningPort.types';
import type {
	DesignRevision,
	DesignVersion
} from '../../../models/development-tooling/Desktop.types';
import { approvalInfo, threadInfo } from '../planningConvert';
import { planningConvert } from './planningConvert';
import { gitText } from '../gitRead';

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
			file: i.file,
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

export type { PlanningContext } from './planRecord.types';
