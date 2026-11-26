// @harness-uid u_u2otpjkis7
import { QaSyncError } from '../../../core/agents-providers/QaSyncError';
import { readFile, stat } from 'node:fs/promises';

const sources = {
	slack: { variable: 'HARNESS_QA_SLACK_TOKEN', option: '--slack-token-file' },
	github: { variable: 'HARNESS_QA_GITHUB_TOKEN', option: '--github-token-file' }
} as const;

/**
 * Resolves a token on each use, so a rotated file takes effect without a restart. A file must be
 * readable by its owner only. The value never appears in errors.
 */
export function qaSyncSecret(
	kind: keyof typeof sources,
	file?: string,
	env: Record<string, string | undefined> = process.env
): () => Promise<string> {
	const { variable, option } = sources[kind];
	return async () => {
		if (file && (await stat(file)).mode & 0o077)
			throw new QaSyncError(`${option} must be readable by its owner only (chmod 600).`);
		const token = (file ? await readFile(file, 'utf8') : (env[variable] ?? '')).trim();
		if (!token || /\s/.test(token))
			throw new QaSyncError(`No usable ${kind} token: pass ${option} or set ${variable}.`);
		return token;
	};
}
