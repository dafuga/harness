// @harness-uid u_mucsxl7k4y
import type { z } from 'zod';
import type { vaultSignupScript } from './browserSignup';

export interface VaultSignup {
	origin: string;
	start: string;
	logout: string;
	identity: string;
	form: z.output<typeof vaultSignupScript>;
}
