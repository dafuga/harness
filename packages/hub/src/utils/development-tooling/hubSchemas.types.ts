import type { z } from 'zod';
import type { hubPlanSchema, hubDesignSchema, hubApprovalSchema } from './hubSchemas';

export type HubPlan = z.infer<typeof hubPlanSchema>;

export type HubDesign = z.infer<typeof hubDesignSchema>;

export type HubApproval = z.infer<typeof hubApprovalSchema>;
