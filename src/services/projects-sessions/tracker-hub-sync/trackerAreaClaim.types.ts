// @harness-uid u_jkomno4o5u
import type { z } from 'zod';
import type { areaClaim } from './trackerAreaClaim';
export type TrackerAreaClaim = z.infer<typeof areaClaim>;
export interface AreaDecision {
	allowed: boolean;
	reason: string;
}
export interface Owner extends Omit<TrackerAreaClaim, 'areas'> {
	node: string;
	areas: string;
}
