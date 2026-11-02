// @harness-uid u_3meooukd2v
import type { z } from 'zod';
import type { unitsConfigSchema } from './unitsConfig';

export type UnitsConfig = z.infer<typeof unitsConfigSchema>;
