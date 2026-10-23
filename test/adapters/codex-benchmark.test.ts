import { expect, test } from 'vitest';
import { CodexBenchmarkAdapter } from '../../src/cli/program/benchmark-service/benchmark-definition/CodexBenchmarkAdapter';
import {
	benchmarkEvents,
	codexTurn
} from '../../src/cli/program/benchmark-service/benchmarkEvents';
import { benchmarkEnvironment } from '../../src/cli/program/benchmark-service/benchmarkProcess';
import { benchmarkFixtureDefinition } from '../support/benchmark';

test('Codex requests explicit settings and resumes an exact session', () => {
	const adapter = new CodexBenchmarkAdapter();
	const input = {
		candidate: benchmarkFixtureDefinition().candidates[0],
		cwd: '/tmp',
		prompt: 'contract',
		signal: new AbortController().signal
	};
	expect(adapter.command(input)).toContain('--ignore-user-config');
	expect(adapter.command(input)).toContain('model_provider="openai"');
	expect(adapter.command({ ...input, session: 'exact-session' }).slice(1, 4)).toEqual([
		'exec',
		'resume',
		'exact-session'
	]);
});
test('Codex requires a completed turn and keeps absent usage unknown', () => {
	const events = benchmarkEvents(
		'{"type":"thread.started","thread_id":"a"}\n{"type":"turn.completed"}'
	);
	expect(codexTurn(events)).toEqual({
		session: 'a',
		reportedModel: undefined,
		usage: { inputTokens: undefined, outputTokens: undefined, cacheReadTokens: undefined }
	});
	expect(() =>
		codexTurn([{ type: 'thread.started', thread_id: 'a' }, { type: 'turn.failed' }])
	).toThrow();
});
test('runner environment excludes provider overrides and project secrets', () => {
	const env = benchmarkEnvironment();
	expect(env.ANTHROPIC_API_KEY).toBeUndefined();
	expect(env.OPENAI_API_KEY).toBeUndefined();
	expect(env.HARNESS_ANALYTICS_DISABLED).toBe('1');
	expect(Object.keys(env)).not.toContain('CLOUDFLARE_API_TOKEN');
});

test('malformed runner usage fails rather than corrupting benchmark totals', () => {
	expect(() =>
		benchmarkEvents('{"type":"turn.completed","usage":{"input_tokens":"unknown"}}')
	).toThrow();
	expect(() => benchmarkEvents('{"type":"result","total_cost_usd":-1}')).toThrow();
});
