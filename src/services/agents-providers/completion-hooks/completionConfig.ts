// @harness-uid u_xghv2ih7cg
import { z } from 'zod';
import type { GitAdapter } from '../../../adapters/git-source-history/GitAdapter';
import { completionHooksConfig } from '../../../configs/agents-providers/completionHooksConfig';
import { CompletionCheckError } from './CompletionCheckError';

const checkDefinition = z.strictObject({
	name: z.string().regex(/^[a-z][a-z0-9-]{0,63}$/),
	scope: z.enum(['orchestrator', 'module']),
	prompt: z.string().trim().min(1).max(8000),
	required: z.boolean(),
	enabled: z.boolean()
});
const configuration = z.strictObject({
	checks: z.array(checkDefinition.partial({ prompt: true, required: true, enabled: true })).max(32),
	moduleVerification: z.array(z.string().min(1).max(1000)).min(1).max(32).optional()
});

export async function loadCompletionConfig(git: GitAdapter, revision: string) {
	const object = `${revision}:${completionHooksConfig.file}`;
	const size = await git.attempt(['cat-file', '-s', object]);
	if (size !== undefined && Number(size) > 65536)
		throw new CompletionCheckError('Completion configuration exceeds 64 KiB.');
	try {
		const configured = configuration.parse(
			size === undefined ? { checks: [] } : JSON.parse(await git.run(['cat-file', 'blob', object]))
		);
		return { ...configured, checks: mergeChecks(configured.checks) };
	} catch (error) {
		if (error instanceof CompletionCheckError) throw error;
		throw new CompletionCheckError('Invalid harness.completion.json.');
	}
}

function mergeChecks(overrides: z.infer<typeof configuration>['checks']) {
	const key = ({ scope, name }: { scope: string; name: string }) => `${scope}/${name}`;
	const checks = new Map(
		completionHooksConfig.checks.map((check) => [key(check), checkDefinition.parse(check)])
	);
	const seen = new Set<string>();
	for (const override of overrides) {
		const id = key(override);
		if (seen.has(id)) throw new CompletionCheckError(`Duplicate completion check ${id}.`);
		seen.add(id);
		checks.set(id, checkDefinition.parse({ ...checks.get(id), ...override }));
	}
	return [...checks.values()].sort(
		(a, b) =>
			Number(a.name === completionHooksConfig.security) -
			Number(b.name === completionHooksConfig.security)
	);
}
