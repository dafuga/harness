// @harness-uid u_bl6xl2h4a3
import type { z } from 'zod';
import type { areaPull } from './trackerAreaPulls';
export type AreaPull = z.infer<typeof areaPull>;
export interface OpenPulls {
	pulls: AreaPull[];
	warning?: string;
}
