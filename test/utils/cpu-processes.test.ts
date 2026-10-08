import { expect, test } from 'vitest';
import { cpuProcesses } from '../../src/utils/cpuProcesses';
test('ignores malformed ps lines and distinguishes the shared app-server', () => {
	const rows = cpuProcesses(
		'garbage\n3 1 0:01 /bin/codex app-server\n4 1 0:01 /bin/codex exec\n5 1 0:01 node @anthropic-ai/claude-code/cli.js',
		100
	);
	expect(rows.map((p) => p.role)).toEqual(['codex', 'agent', 'agent']);
});

test('includes the desktop host used by the installed Codex app', () => {
	const rows = cpuProcesses('64226 1 0:30 /Applications/ChatGPT.app/Contents/MacOS/ChatGPT', 100);
	expect(rows[0].role).toBe('codex');
});
