// @harness-uid u_mo4ka6dupc
import type { z } from 'zod';
import type {
	environment,
	observation,
	profile,
	release,
	plan,
	journal,
	signedProof,
	deployment,
	smoke
} from './contracts';

export type Environment = z.infer<typeof environment>;
export type Observation = z.infer<typeof observation>;
export type Profile = z.infer<typeof profile>;
export type Release = z.infer<typeof release>;
export type Plan = z.infer<typeof plan>;
export type Journal = z.infer<typeof journal>;
export type Proof = z.infer<typeof signedProof>;
export type Deployment = z.infer<typeof deployment>;
export type Smoke = z.infer<typeof smoke>;

export type CanonicalValue = string | number | boolean | object | null;
