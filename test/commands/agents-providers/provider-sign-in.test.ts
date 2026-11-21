import { expect, test, vi } from 'vitest';
import { ProviderSignInCommand } from '../../../src/commands/agents-providers/ProviderSignInCommand';
import { measureWorkload } from '../../support/measureWorkload';

test('status and sign-in use the fixed local provider commands', async () => {
	const locate = vi.fn((command: string) => `/fixture/${command}`);
	const launch = vi.fn(async (_path: string, _args: readonly string[]) => 0);
	const provider = new ProviderSignInCommand({ locate, launch });
	for (const [name, command, args] of [
		['chatgpt', 'codex', ['login']],
		['claude', 'claude', ['auth', 'login']],
		['gemini', 'gemini', []]
	] as const) {
		expect(provider.status(name)).toEqual({ provider: name, command, available: true });
		expect(
			await measureWorkload('command.agents-providers-provider-sign-in', `launch-${name}`, () =>
				provider.run(name)
			)
		).toBe(0);
		expect(launch).toHaveBeenLastCalledWith(`/fixture/${command}`, args);
	}
});

test('missing and invalid providers never launch a process', async () => {
	const locate = vi.fn(() => null);
	const launch = vi.fn();
	const provider = new ProviderSignInCommand({ locate, launch });
	expect(provider.status('gemini')).toEqual({
		provider: 'gemini',
		command: 'gemini',
		available: false
	});
	expect(() => provider.status('other')).toThrow('Unknown sign-in provider.');
	await expect(provider.run('gemini')).rejects.toThrow('Gemini CLI is not installed.');
	await expect(provider.run('codex; exit 1')).rejects.toThrow('Unknown sign-in provider.');
	expect(launch).not.toHaveBeenCalled();
});

test('a provider exit keeps its status and launch failures have a bounded message', async () => {
	const launch = vi.fn(async () => 130);
	const provider = new ProviderSignInCommand({ locate: () => '/fixture/codex', launch });
	expect(await provider.run('chatgpt')).toBe(130);
	launch.mockRejectedValueOnce(new Error('private process diagnostic'));
	await expect(provider.run('chatgpt')).rejects.toThrow(/^Could not start Codex CLI\.$/);
});
