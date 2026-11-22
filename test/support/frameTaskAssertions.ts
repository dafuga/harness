import { expect } from '../verificationExpect';
import { ModuleTaskRunnerAdapter } from '../../src/adapters/agents-providers/ModuleTaskRunnerAdapter';

export async function assertFrameArguments(runner: ModuleTaskRunnerAdapter) {
	const selection = {
		provider: 'codex' as const,
		model: 'gpt-6.1-sol',
		intelligence: 'xhigh',
		images: ['/tmp/frame with spaces.png', '/tmp/second.png']
	};
	expect(runner.command(selection), 'Codex receives every frame as an image argument').toEqual(
		expect.arrayContaining(['-i', selection.images[0], '-i', selection.images[1]])
	);
	const claude = new ModuleTaskRunnerAdapter(async (_command, input) => {
		expect(input.prompt).toContain('Read');
		expect(input.prompt).toContain(JSON.stringify(selection.images[0]));
		return {
			code: 0,
			stdout:
				'{"type":"system","subtype":"init","model":"claude-haiku-5-5"}\n{"type":"result","is_error":false,"result":"Reviewed frame"}'
		};
	});
	await claude.run({
		...selection,
		provider: 'claude',
		model: 'claude-haiku-5-5',
		cwd: '.',
		prompt: 'Review the flagged motion',
		signal: new AbortController().signal
	});
}
