import { expect, test } from 'vitest';
import { ClaudeBenchmarkAdapter } from '../../src/cli/program/benchmark-service/benchmark-definition/ClaudeBenchmarkAdapter';
import { claudeTurn } from '../../src/cli/program/benchmark-service/benchmarkEvents';
import { benchmarkFixtureDefinition } from '../support/benchmark';

test('Claude pins model, tools, effort and exact session without user configuration', () => {
	const candidate = {
		...benchmarkFixtureDefinition().candidates[0],
		runner: 'claude' as const,
		tools: 'files' as const
	};
	const args = new ClaudeBenchmarkAdapter().command({
		candidate,
		cwd: '/tmp',
		prompt: 'contract',
		session: 'exact',
		signal: new AbortController().signal
	});
	expect(args).toContain('--safe-mode');
	expect(args).toContain('bypassPermissions');
	expect(args).toContain('Read,Edit,Write,Glob,Grep');
	expect(args.slice(-2)).toEqual(['--resume', 'exact']);
});
test('Claude requires success and retains reported cumulative cost', () => {
	const turn = claudeTurn([
		{ type: 'system', subtype: 'init', model: 'explicit-model' },
		{
			type: 'result',
			subtype: 'success',
			session_id: 'a',
			total_cost_usd: 0.02,
			usage: { input_tokens: 12, output_tokens: 3 }
		}
	]);
	expect(turn).toMatchObject({
		session: 'a',
		reportedModel: 'explicit-model',
		usage: { reportedCostUsd: 0.02, inputTokens: 12, outputTokens: 3 }
	});
	expect(() =>
		claudeTurn([{ type: 'result', subtype: 'error', session_id: 'a', is_error: true }])
	).toThrow();
});
