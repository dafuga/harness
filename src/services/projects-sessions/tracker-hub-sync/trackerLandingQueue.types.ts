// @harness-uid u_jkomno4o5u
import type { z } from 'zod';
import type { landingDecision, landingRequest } from './trackerLandingQueue';
export type LandingRequest = z.infer<typeof landingRequest>;
export type LandingDecision = z.infer<typeof landingDecision>;
export interface Entry {
	ticket: string;
	id: string;
	node: string;
	repo: string;
	pr: number;
	phase: string;
	base: string | null;
	head: string | null;
}
