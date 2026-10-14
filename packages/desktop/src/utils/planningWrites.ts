import type { ComponentManifest } from '../../../../src/lib/contracts';
import type { PlanDetail, PlanViewport } from '../../../planning/src/index';
import type { ApprovalDraft, PlanDraft, ThreadDraft } from '../models/DesktopBridge.types';
import type { DesignDraft } from '../models/PlanningPort.types';
import type { PlanningContext } from './planningReads';
import { planRecord, planVersion } from './planningReads';
import { approvalInfo, threadInfo } from './planningConvert';
export const reviewer = { kind: 'person' as const, name: 'Local reviewer' };
export async function planningWrites(context: PlanningContext, draft: PlanDraft) {
	const slug = draft.title
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-|-$/g, '')
		.slice(0, 64);
	if (!slug) throw new Error('Use a title containing letters or numbers.');
	const category = draft.category.slice(0, -1) as PlanDetail['category'];
	const result = await context.api.createPlan({
		category,
		slug,
		title: draft.title,
		goal: draft.goal,
		author: reviewer,
		// A proposed contract is kept as it was authored; its states and viewports are never proposed.
		contract: {
			responsibility: draft.goal,
			inputs: draft.contract?.inputs ?? [],
			outputs: draft.contract?.outputs ?? [],
			errors: draft.contract?.errors ?? [],
			states: ['default'],
			viewports: visual(category) ? ['desktop'] : ['diagram']
		}
	});
	return planRecord(context, result.value, result.commit);
}
export async function ensurePlan(context: PlanningContext, unit: ComponentManifest) {
	const existing = (await context.api.listPlans()).find((p) => p.unitId === unit.id);
	if (existing) return planRecord(context, await context.api.readPlan({ unitId: unit.id }), 'HEAD');
	const category =
		unit.kind === 'shared-function' ? 'function' : (unit.kind as PlanDetail['category']);
	const result = await context.api.createPlan({
		unitId: unit.id,
		category,
		slug: unit.id.replace(/\./g, '-').slice(0, 64),
		title: unit.title,
		goal: unit.responsibility,
		author: reviewer,
		contract: {
			responsibility: unit.responsibility,
			inputs: unit.contract.inputs,
			outputs: unit.contract.outputs,
			errors: unit.contract.errors.map((e) => e.name),
			states: ['default'],
			viewports: visual(category) ? ['desktop'] : ['diagram']
		}
	});
	return planRecord(context, result.value, result.commit);
}
export async function addPlanDesign(context: PlanningContext, draft: DesignDraft) {
	const plan = await context.api.readPlan({ unitId: draft.entityId });
	const revised = plan.versions.find((v) => v.version === draft.revises?.version);
	const anchor = revised?.images.find((i) => i.sha256 === draft.revises?.imageSha256);
	// The option of the revised image comes from the stored version, never from the caller.
	const option = revised?.options?.find((o) => o.images.some((i) => i.file === anchor?.file))?.id;
	const result = await context.api.addDesign({
		unitId: draft.entityId,
		prompt: draft.prompt,
		generator: draft.generator,
		baseRevision: draft.baseRevision,
		expectedLatest: draft.expectedLatest === undefined ? plan.latestVersion : draft.expectedLatest,
		...designImages(draft),
		notes: draft.notes,
		revises:
			anchor && draft.revises
				? { ...draft.revises, file: anchor.file, ...(option ? { option } : {}) }
				: undefined
	});
	return planVersion(context, {
		version: result.value,
		plan: await context.api.readPlan({ unitId: draft.entityId }),
		revision: result.commit
	});
}
export async function openPlanThread(context: PlanningContext, draft: ThreadDraft) {
	const plan = await context.api.readPlan({ unitId: draft.entityId });
	const image = plan.versions
		.find((v) => v.version === draft.version)
		?.images.find((i) => i.sha256 === draft.imageSha256);
	if (draft.version && !image) throw new Error('The image anchor does not belong to this entity.');
	if (image && (image.state !== draft.state || image.viewport !== draft.viewport))
		throw new Error('The image state/viewport anchor does not match.');
	return threadInfo(
		(
			await context.api.openThread({
				unitId: draft.entityId,
				version: draft.version,
				file: image?.file ?? null,
				imageSha256: draft.imageSha256,
				region: draft.region,
				option: draft.option,
				author: reviewer
			})
		).value
	);
}
export async function approvePlanDesign(context: PlanningContext, draft: ApprovalDraft) {
	const plan = await context.api.readPlan({ unitId: draft.entityId }),
		version = plan.versions.find((v) => v.version === draft.version);
	if (!version) throw new Error('Unknown design version.');
	const group = version.options?.find((o) => o.id === draft.option)?.images ?? version.images;
	const images = group
		.filter((i) => draft.imageHashes.includes(i.sha256))
		.map((i) => ({ file: i.file, sha256: i.sha256 }));
	if (images.length !== draft.imageHashes.length)
		throw new Error('Approval images do not match the version.');
	return approvalInfo(
		(
			await context.api.approveDesign({
				unitId: draft.entityId,
				version: draft.version,
				...(draft.option ? { option: draft.option } : {}),
				images,
				notesSha256: version.notes?.sha256 ?? null,
				contractHash: draft.contractHash,
				reviewer: reviewer.name
			})
		).value
	);
}
/** A single design's one image, or each separately generated option with its own image. */
function designImages(draft: DesignDraft) {
	const image = (bytes: Uint8Array) => [
		{ state: draft.state, viewport: draft.viewport as PlanViewport, bytes }
	];
	if (!draft.options) return { images: draft.bytes ? image(draft.bytes) : [] };
	const options = draft.options.map(({ direction, bytes, prompt, revisedPrompt }) => ({
		...{ direction, prompt, revisedPrompt, generator: draft.generator },
		images: image(bytes)
	}));
	return { options };
}
function visual(category: string) {
	return ['page', 'shell', 'component'].includes(category);
}
