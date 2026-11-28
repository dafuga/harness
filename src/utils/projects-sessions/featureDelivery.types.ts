import type { z } from 'zod';
import type {
	featureDeliveryPageSchema,
	featureDeliverySchema,
	featureDeliveryStage
} from './featureDelivery';

export type FeatureDelivery = z.infer<typeof featureDeliverySchema>;
export type FeatureDeliveryPage = z.infer<typeof featureDeliveryPageSchema>;
export type FeatureDeliveryStage = z.infer<typeof featureDeliveryStage>;
