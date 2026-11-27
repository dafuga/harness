// @harness-uid u_l5iouygbhe
import { z } from 'zod';
import { sanitizeTrackerText } from './sanitizeTrackerText';
import { trackerItemError } from './trackerItemError';
import type { TrackerPlanning, TrackerPlanningFields, TrackerStage } from './trackerPlanning.types';

export const trackerStages = ['idea', 'detail', 'design', 'build'] as const;
export const trackerStageLabels: Record<TrackerStage, string> = {
	idea: 'Idea',
	detail: 'Detailed idea',
	design: 'Full design',
	build: 'Implementation'
};

export const trackerPromotionStages = ['detail', 'design', 'build'] as const;
export const trackerPlanningArtifactFields = [
	'planning_artifact_idea',
	'planning_artifact_detail',
	'planning_artifact_design',
	'planning_artifact_build'
] as const;
export const trackerPlanningPromotionFields = [
	'planning_promotion_detail',
	'planning_promotion_design',
	'planning_promotion_build'
] as const;

export const trackerStageSchema = z.enum(trackerStages);
const planningText = z.string().trim().min(1).transform(sanitizeTrackerText);
export const trackerArtifactUrlSchema = z.url({ protocol: /^https$/ }).refine((value) => {
	const { username, password, href } = new URL(value);
	return !username && !password && sanitizeTrackerText(href) === href;
});
const link = z.strictObject({
	label: planningText,
	url: trackerArtifactUrlSchema,
	kind: z.enum(['link', 'image']).optional()
});
const page = z.strictObject({
	name: planningText,
	states: z.record(planningText, planningText).optional(),
	links: z.array(link).optional()
});
export const trackerArtifactSchema = z
	.strictObject({
		summary: planningText.optional(),
		pages: z.array(page).optional(),
		links: z.array(link).optional()
	})
	.refine(
		({ summary, pages, links }) =>
			summary !== undefined || (pages?.length ?? 0) > 0 || (links?.length ?? 0) > 0
	);
const receipt = z.strictObject({
	by: z.string().min(1).max(80).transform(sanitizeTrackerText),
	at: z.iso.datetime()
});

export const trackerPlanningSchema = z.object({
	artifacts: z.partialRecord(trackerStageSchema, trackerArtifactSchema),
	promotions: z.array(receipt.extend({ stage: z.enum(trackerPromotionStages) })).max(3)
});

export const trackerArtifactMaxBytes = 24 * 1024;

export function trackerStage(value: unknown): TrackerStage {
	const parsed = trackerStageSchema.safeParse(value);
	if (!parsed.success) throw trackerItemError('stage must be idea, detail, design or build');
	return parsed.data;
}

export function trackerPlanningStage(fields: TrackerPlanningFields): TrackerStage {
	if (fields.planning_promotion_build != null) return 'build';
	if (fields.planning_promotion_design != null) return 'design';
	if (fields.planning_promotion_detail != null) return 'detail';
	return 'idea';
}

export const trackerPlanningStageSql = `CASE
	WHEN planning_promotion_build IS NOT NULL THEN 'build'
	WHEN planning_promotion_design IS NOT NULL THEN 'design'
	WHEN planning_promotion_detail IS NOT NULL THEN 'detail'
	ELSE 'idea' END`;

export function encodeTrackerArtifact(input: unknown): string | null {
	if (input === null) return null;
	const result = trackerArtifactSchema.safeParse(input);
	if (!result.success) throw trackerItemError('invalid planning artifact');
	const raw = JSON.stringify(result.data);
	if (Buffer.byteLength(raw) > trackerArtifactMaxBytes) {
		throw trackerItemError('planning artifact is larger than 24 KiB', 413);
	}
	return raw;
}

/** Project the stage documents and each admitted promotion from journal-backed item fields. */
export function trackerPlanning(fields: TrackerPlanningFields): TrackerPlanning {
	const artifacts = Object.fromEntries(
		trackerStages.flatMap((stage) => {
			const field = fields[`planning_artifact_${stage}`];
			if (!field || Buffer.byteLength(field) > trackerArtifactMaxBytes) return [];
			const parsed = trackerArtifactSchema.safeParse(parsePlanningJson(field));
			return parsed.success ? [[stage, parsed.data]] : [];
		})
	);
	const promotions = trackerPromotionStages.flatMap((stage) => {
		const parsed = receipt.safeParse(parsePlanningJson(fields[`planning_promotion_${stage}`]));
		return parsed.success ? [{ stage, ...parsed.data }] : [];
	});
	return { artifacts, promotions };
}

function parsePlanningJson(raw: string | null | undefined): unknown {
	try {
		return raw ? JSON.parse(raw) : null;
	} catch {
		return null;
	}
}
