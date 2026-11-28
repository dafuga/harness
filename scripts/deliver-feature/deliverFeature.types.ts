import type { TrackerItem } from '../../src/repositories/projects-sessions/TrackerItemReadRepository.types';
import type {
	FeatureDelivery,
	FeatureDeliveryStage
} from '../../src/utils/projects-sessions/featureDelivery.types';
import type { TrackerArtifact } from '../../src/utils/projects-sessions/trackerPlanning.types';

export type DeliveryInput = {
	id: string;
	stage: FeatureDeliveryStage;
	origin: string;
	note: string;
	backfillAt?: string;
	attach?: boolean;
};

export type DeliveryCapture = { bytes: Buffer; durationSeconds: number };

export type DeliveryServices = {
	readItem(id: string): Promise<TrackerItem>;
	capture(): Promise<DeliveryCapture>;
	storeVideo(delivery: FeatureDelivery, bytes: Buffer): Promise<void>;
	attach(id: string, artifact: TrackerArtifact): Promise<void>;
	record(id: string, note: string, complete: boolean): Promise<void>;
	publish(delivery: FeatureDelivery): Promise<void>;
	now(): Date;
};
