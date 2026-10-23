import type { z } from 'zod';
import type { verifyConfigSchema, captureLineSchema, workloadSchema } from './verifyTypes';

export type VerifyConfig = z.infer<typeof verifyConfigSchema>;

export type CaptureLine = z.infer<typeof captureLineSchema>;

export type Workload = z.infer<typeof workloadSchema>;
