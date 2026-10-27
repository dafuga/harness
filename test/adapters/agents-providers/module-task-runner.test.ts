import { test } from 'vitest';
import { expect } from '../../verificationExpect';
import { ModuleTaskRunnerAdapter } from '../../../src/adapters/agents-providers/ModuleTaskRunnerAdapter';
import { assertTaskModelIdentity } from '../../support/taskModelIdentity';
import { observedTaskOperation } from '../../support/taskProfiles';
import { isolateRunnerEnvironment } from './module-task-runner-environment.test.fixtures';
import {
	claudeCompletion,
	claudeOtherModelCompletion,
	failedUsageEvent,
	fallbackEvent,
	invokeRunner,
	makeCodexInput,
	makeCleanupProbe,
	makeMissingScopeProbe,
	makePrepareRejectionProbe,
	makeTaskInput,
	usageEvents,
	makeWrapperProbe,
	runnerFor
} from './module-task-runner.test.fixtures';
isolateRunnerEnvironment();
test('Claude and Codex launch exact models and intelligence without shell interpolation', () => {
	const runner = new ModuleTaskRunnerAdapter();
	expect(
		runner.command({ provider: 'claude', model: 'claude-haiku-5-5', intelligence: 'high' })
	).toEqual(expect.arrayContaining(['--model', 'claude-haiku-5-5', '--effort', 'high']));
	const codex = runner.command({ provider: 'codex', model: 'gpt-6-luna', intelligence: 'max' });
	expect(codex).toEqual(
		expect.arrayContaining([
			'-m',
			'gpt-6-luna',
			'model_reasoning_effort="max"',
			'model_provider="openai"',
			'--sandbox',
			'danger-full-access',
			'-c',
			'approval_policy="never"'
		])
	);
	expect(codex).not.toEqual(
		expect.arrayContaining(['--dangerously-bypass-approvals-and-sandbox', '--approve-for-me'])
	);
});
test('successful public Claude CLI events retain requested model and summary', async () => {
	const runner = runnerFor(async () => ({
		code: 0,
		stdout: claudeCompletion('claude-haiku-5-5', 'Implemented')
	}));
	const result = await observedTaskOperation(
		'adapter.agents-providers-module-task-runner',
		'parse-synthetic-cli-completion-only',
		() => runner.run(makeTaskInput())
	);
	expect(result).toMatchObject({
		model: 'claude-haiku-5-5',
		reportedModel: 'claude-haiku-5-5',
		text: 'Implemented'
	});
});
test.each(['quota', 'authentication', 'text-only-quota'])(
	'fallback eligibility uses structured quota signals (%s)',
	async (kind) => {
		const runner = runnerFor(async () => ({
			code: 1,
			stdout: fallbackEvent(kind)
		}));
		await expect(runner.run(makeTaskInput())).rejects.toMatchObject({
			quotaRejected: kind === 'quota'
		});
	}
);
test('a completed CLI run that reports another model is rejected', async () => {
	const runner = runnerFor(async () => ({
		code: 0,
		stdout: claudeOtherModelCompletion()
	}));
	await expect(runner.run(makeTaskInput())).rejects.toThrow('different model');
	await observedTaskOperation(
		'adapter.agents-providers-module-task-runner',
		'require-public-model-identity',
		assertTaskModelIdentity
	);
});
test.each(['claude', 'codex'] as const)(
	'public %s usage is retained without guessing absent counters',
	async (provider) => {
		const model = provider === 'claude' ? 'claude-haiku-5-5' : 'gpt-6-luna';
		const runner = runnerFor(async () => ({
			code: 0,
			stdout: usageEvents(provider, model)
		}));
		const result = await runner.run(makeTaskInput(provider, model));
		expect(result).toMatchObject({
			usage: {
				inputTokens: 35,
				outputTokens: 4,
				cacheReadTokens: 10,
				cacheWriteTokens: provider === 'claude' ? 20 : null,
				reportedCostUsd: provider === 'claude' ? 0.02 : null
			}
		});
	}
);
test('failed turns preserve available usage for cost attribution', async () => {
	const runner = runnerFor(async () => ({
		code: 1,
		stdout: failedUsageEvent()
	}));
	await expect(runner.run(makeTaskInput())).rejects.toMatchObject({
		usage: { inputTokens: 7, outputTokens: 2, reportedCostUsd: 0.01 }
	});
});
const runCodexFailure = (stdout: string, stderr: string) =>
	invokeRunner(async () => ({ code: 1, stdout, stderr }), makeCodexInput());
const privateDiagnostic = 'sk-test-provider-secret https://provider.invalid';
const codexError = (message: string) => JSON.stringify({ type: 'error', message });
const failedTurn = (message: string) => JSON.stringify({ type: 'turn.failed', error: { message } });
const modelUnavailable = 'gpt-6-luna unavailable; request model access';
const stderr = {
	authentication: `Run codex login; ${privateDiagnostic}/auth`,
	modelAccess: `${privateDiagnostic}/model`,
	permission: `Grant workspace read permission; ${privateDiagnostic}/permission`
};
const nextStep = {
	authentication: /codex login/i,
	modelAccess: /request model access/i,
	permission: /grant workspace read permission/i,
	malformed: /invalid response/i,
	unknown: /^Codex task failed; inspect CLI authentication, permissions or model access\.$/
};

test.each([
	['auth', codexError('Authentication required'), stderr.authentication, nextStep.authentication],
	['model', failedTurn(modelUnavailable), stderr.modelAccess, nextStep.modelAccess],
	['permission', failedTurn('Permission denied'), stderr.permission, nextStep.permission],
	['malformed', `{invalid ${privateDiagnostic}/error`, '', nextStep.malformed],
	['unknown', codexError('Unexpected provider failure'), '', nextStep.unknown]
] as const)(
	'Codex %s failures are safe and actionable without quota fallback',
	async (_, stdout, stderr, nextStep) => {
		const failure = runCodexFailure(stdout, stderr);
		await expect(failure).rejects.toMatchObject({ quotaRejected: false });
		await expect(failure).rejects.toThrow(nextStep);
		await expect(failure).rejects.not.toThrow(/sk-test-provider-secret|provider\.invalid/i);
	}
);

test('Codex execute rejection remains distinct from a provider failure', async () => {
	const spawnError = new Error('Codex process could not be spawned');
	const runner = runnerFor(async () => {
		throw spawnError;
	});
	await expect(runner.run(makeCodexInput())).rejects.toThrow(spawnError.message);
});

test('missing trusted scope fails before sandbox or process launch', async () => {
	await expect(new ModuleTaskRunnerAdapter().ready()).rejects.toMatchObject({
		quotaRejected: false
	});
	let qualified = 0;
	await new ModuleTaskRunnerAdapter(undefined, undefined, async () => {
		qualified++;
	}).ready();
	expect(qualified).toBe(1);
	const { run, prepare, execute } = makeMissingScopeProbe();
	const failure = await run.catch((error: unknown) => error);
	expect(failure).toMatchObject({ quotaRejected: false });
	expect(failure).not.toHaveProperty('usage');
	expect(prepare).not.toHaveBeenCalled();
	expect(execute).not.toHaveBeenCalled();
	for (const provider of ['claude', 'codex'] as const) {
		const unqualified = makeMissingScopeProbe(provider);
		const rejection = await unqualified.run.catch((error: unknown) => error);
		expect(rejection).toMatchObject({ quotaRejected: false });
		expect(rejection).not.toHaveProperty('usage');
		expect(unqualified.prepare).not.toHaveBeenCalled();
		expect(unqualified.execute).not.toHaveBeenCalled();
	}
});

test('sandbox preparation rejection is safe and never launches provider work', async () => {
	const { run, prepare, execute } = makePrepareRejectionProbe();
	const failure = await run.catch((error: unknown) => error);
	expect(failure).toMatchObject({ quotaRejected: false });
	expect(failure).not.toHaveProperty('usage');
	expect((failure as Error).message.length).toBeLessThan(256);
	expect((failure as Error).message).not.toMatch(/\.ssh|sk-test-provider-secret/i);
	expect(prepare).toHaveBeenCalledTimes(1);
	expect(execute).not.toHaveBeenCalled();
});

test('provider execution forwards exact sandbox argv, cwd and environment', async () => {
	const probe = makeWrapperProbe();
	await probe.run;
	expect(probe.qualification).toHaveBeenCalledTimes(1);
	expect(probe.providerArgv()).toEqual(new ModuleTaskRunnerAdapter().command(probe.input));
	expect(probe.execute.mock.calls[0]?.[0]).toEqual([probe.wrapper.command, ...probe.wrapper.args]);
	expect(probe.execute.mock.calls[0]?.[1]).toMatchObject({
		cwd: probe.wrapper.cwd,
		env: probe.wrapper.env
	});
	expect(probe.execute.mock.calls[0]?.[1]?.env).toEqual(probe.wrapper.env);
	expect(probe.input).toEqual(probe.before);
	expect(probe.cleanup).toHaveBeenCalledTimes(1);
});

test.each(['resolve', 'reject', 'cancel'] as const)(
	'cleans the wrapped process once after execute %s',
	async (outcome) => {
		const probe = makeCleanupProbe(outcome);
		if (outcome === 'resolve') await expect(probe.run).resolves.toMatchObject({ text: 'Done' });
		else if (outcome === 'cancel')
			await expect(probe.run).rejects.toMatchObject({ name: 'AbortError' });
		else await expect(probe.run).rejects.toThrow('synthetic process failure');
		expect(probe.execute.mock.calls[0]?.[1]?.signal).toBe(probe.controller.signal);
		expect(probe.cleanup).toHaveBeenCalledTimes(1);
	}
);
