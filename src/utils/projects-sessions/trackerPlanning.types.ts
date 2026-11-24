// @harness-uid u_l5iouygbhe
import type { z } from 'zod';
import type {
	trackerArtifactSchema,
	trackerPlanningArtifactFields,
	trackerPlanningPromotionFields,
	trackerStages
} from './trackerPlanning';

export type TrackerStage = (typeof trackerStages)[number];
export type TrackerArtifact = z.infer<typeof trackerArtifactSchema>;
export type TrackerPlanningFields = Partial<
	Record<
		| (typeof trackerPlanningArtifactFields)[number]
		| (typeof trackerPlanningPromotionFields)[number],
		string | null
	>
>;
export type TrackerPromotion = { stage: Exclude<TrackerStage, 'idea'>; by: string; at: string };
export type TrackerPlanning = {
	artifacts: Partial<Record<TrackerStage, TrackerArtifact>>;
	promotions: TrackerPromotion[];
};
