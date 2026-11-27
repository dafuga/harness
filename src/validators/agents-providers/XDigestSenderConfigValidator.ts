// @harness-uid u_z43xcnkqer
import { z } from 'zod';
import type { UntrustedValue } from '../../core/agents-providers/projectAssistant.types';
import type { XDigestSenderConfig } from '../../core/agents-providers/xDigestSend.types';
import { ExpectedCliError } from '../../core/development-tooling/errors';

const name = z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,127}$/u);

const schema = z.strictObject({
	source: z.strictObject({
		// Both reach a remote shell, so they are limited to characters it cannot interpret.
		host: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._@-]{0,200}$/u),
		directory: z
			.string()
			.regex(/^[A-Za-z0-9._][A-Za-z0-9._/-]{0,300}$/u)
			.refine((path) => !path.split('/').includes('..'), 'must not contain ..')
			.default('.local/share/harness-x-digest/out')
	}),
	slack: z.strictObject({
		installation: z.strictObject({
			installationId: name,
			project: name,
			environment: name,
			workspaceId: z.string().regex(/^T[A-Z0-9]{1,63}$/u),
			botId: z.string().regex(/^B[A-Z0-9]{1,63}$/u),
			botUserId: z.string().regex(/^[UW][A-Z0-9]{1,63}$/u)
		}),
		// A direct message only: a private feed digest must never reach a channel.
		channel: z.string().regex(/^D[A-Z0-9]{1,63}$/u),
		secret: z.strictObject({ project: name, name })
	}),
	tracker: z.strictObject({
		item: z.string().regex(/^[a-z0-9]{6,12}$/u),
		command: z.string().min(1).default('tracker')
	})
});

/** The sender's config. It names the secret and never holds a credential. */
export class XDigestSenderConfigValidator {
	parse(value: UntrustedValue): XDigestSenderConfig {
		const parsed = schema.safeParse(value);
		if (parsed.success) return parsed.data;
		const issue = parsed.error.issues[0];
		throw new ExpectedCliError(
			`Invalid X digest sender config: ${issue.path.join('.')} ${issue.message}`
		);
	}
}
