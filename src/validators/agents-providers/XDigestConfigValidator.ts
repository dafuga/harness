// @harness-uid u_vnpkolzkuz
import { z } from 'zod';
import type { UntrustedValue } from '../../core/agents-providers/projectAssistant.types';
import type { XDigestConfig } from '../../core/agents-providers/xDigest.types';
import { ExpectedCliError } from '../../core/development-tooling/errors';

const limit = (fallback: number, max: number) => z.number().int().min(1).max(max).default(fallback);

const schema = z.strictObject({
	profile: z.string().regex(/^[a-z0-9][a-z0-9-]{0,39}$/u),
	viewer: z.strictObject({
		url: z.url({ protocol: /^https?$/u }).max(200),
		port: z.number().int().min(1024).max(65535),
		hosts: z.array(z.string().min(1).max(253)).min(1)
	}),
	outbox: z.string().min(1).optional(),
	tracker: z.strictObject({
		item: z.string().regex(/^[a-z0-9]{6,12}$/u),
		command: z.string().min(1).default('tracker')
	}),
	limits: z
		.strictObject({
			mentions: limit(20, 50),
			following: limit(10, 30),
			forYou: limit(8, 30),
			scan: limit(60, 100)
		})
		.prefault({})
});

/** The config names things; it never holds a credential. */
export class XDigestConfigValidator {
	parse(value: UntrustedValue): XDigestConfig {
		const parsed = schema.safeParse(value);
		if (parsed.success) return parsed.data;
		const issue = parsed.error.issues[0];
		throw new ExpectedCliError(`Invalid X digest config: ${issue.path.join('.')} ${issue.message}`);
	}
}
