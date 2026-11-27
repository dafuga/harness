// @harness-uid u_kg5hqo2pqr
import { z } from 'zod';
import type {
	ProjectAssistantConfig,
	UntrustedValue
} from '../../core/agents-providers/projectAssistant.types';

const slug = z.string().regex(/^[a-z0-9][a-z0-9_-]{0,63}$/);
const repoPart = z.string().regex(/^[A-Za-z0-9_.-]{1,100}$/);
const digits = z.string().regex(/^[0-9]{1,20}$/);
const channel = z.string().regex(/^[CG][A-Z0-9]{1,63}$/);
const user = z.string().regex(/^[UW][A-Z0-9]{1,63}$/);
const httpsUrl = z.string().refine((value) => {
	const url = URL.parse(value);
	return url?.protocol === 'https:' && !url.username && !url.password && !url.search && !url.hash;
});

const schema = z.strictObject({
	project: slug,
	displayName: z.string().min(1).max(80),
	github: z.strictObject({
		owner: repoPart,
		repo: repoPart,
		appId: digits,
		installationId: digits,
		stagingBranch: z.string().min(1).max(100),
		mainBranch: z.string().min(1).max(100)
	}),
	tracker: z.strictObject({ agent: slug, owner: z.string().min(1).max(80) }),
	health: z.record(slug, httpsUrl),
	writers: z.array(user).max(50),
	answerChannels: z.array(channel).min(1).max(50),
	answerDirectMessages: z.boolean()
});

/** Parses a project's assistant configuration. Credentials never belong in it. */
export class ProjectAssistantConfigValidator {
	parse(value: UntrustedValue): ProjectAssistantConfig {
		return schema.parse(value);
	}
}
