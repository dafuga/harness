// @harness-uid u_dalbqdzx7b
import { z } from 'zod';
import type { QaSyncConfig } from '../../core/agents-providers/qaSync.types';
import type { UntrustedValue } from '../../core/agents-providers/projectAssistant.types';

const slug = z.string().regex(/^[a-z0-9][a-z0-9_-]{0,63}$/);
const repoPart = z.string().regex(/^[A-Za-z0-9_.-]{1,100}$/);
const channel = z.string().regex(/^[CG][A-Z0-9]{1,63}$/);
const user = z.string().regex(/^[UW][A-Z0-9]{1,63}$/);
const sender = z.string().regex(/^[UWB][A-Z0-9]{1,63}$/);
const emoji = z.string().regex(/^[a-z0-9_+-]{1,64}$/);
const word = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9 _-]{0,31}$/);
/** GitHub caps label names at 50 characters; a comma would split one label into two. */
const label = (placeholder: string) =>
	z
		.string()
		.max(50)
		.refine((value) => value.includes(placeholder) && !value.includes(','), {
			message: `must contain ${placeholder} and no comma`
		});

const retest = z.strictObject({
	label: label('{environment}').default('needs testing on {environment}'),
	environments: z.record(slug, z.array(word).min(1).max(10)).default({ staging: ['staging'] }),
	defaultEnvironment: slug.default('staging'),
	requesters: z.array(sender).max(50).default([])
});

const schema = z
	.strictObject({
		project: slug,
		slack: z.strictObject({
			workspaceId: z.string().regex(/^T[A-Z0-9]{1,63}$/),
			channels: z.array(channel).min(1).max(20)
		}),
		github: z.strictObject({ owner: repoPart, repo: repoPart }),
		threads: z.strictObject({
			authors: z.array(sender).min(1).max(20),
			headingMarker: z.string().min(1).max(40).default('QA · #')
		}),
		testers: z
			.array(z.strictObject({ slackUser: user, name: word }))
			.min(1)
			.max(50),
		approval: z
			.strictObject({
				reactions: z
					.array(emoji)
					.min(1)
					.max(10)
					.default(['white_check_mark', 'heavy_check_mark', 'ballot_box_with_check']),
				label: label('{name}').default('approved by {name}')
			})
			.prefault({}),
		retest: retest.prefault({}),
		tracker: z.strictObject({ agent: slug, inboxItem: z.string().regex(/^[a-z0-9]{6,12}$/) }),
		lookbackDays: z.number().int().min(1).max(90).default(30)
	})
	.refine((config) => Object.hasOwn(config.retest.environments, config.retest.defaultEnvironment), {
		message: 'retest.defaultEnvironment must be one of retest.environments',
		path: ['retest', 'defaultEnvironment']
	});

/** Parses a project's QA sync configuration and fills the defaults. */
export class QaSyncConfigValidator {
	parse(value: UntrustedValue): QaSyncConfig {
		return schema.parse(value);
	}
}
