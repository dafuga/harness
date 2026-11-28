// @harness-uid u_jkomno4o5u
import type { z } from 'zod';
import type { areaClaim, areaDecision } from './trackerAreaClaim';
export type TrackerAreaClaim = z.infer<typeof areaClaim>;
export type AreaDecision = z.infer<typeof areaDecision>;
export interface AreaReservation {
	req: TrackerAreaClaim;
	node: string;
	areas: string[];
	own?: Owner;
}
export interface Owner extends Omit<TrackerAreaClaim, 'areas'> {
	node: string;
	areas: string;
}
