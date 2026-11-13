import { expect, test, vi } from 'vitest';
import {
	BoundedCommandAdapter,
	commandEnvironment
} from '../../../src/adapters/execution-runtimes/BoundedCommandAdapter';
import { measureWorkload } from '../../support/measureWorkload';
// Initial public method matrix: async/sync normal, failed, invalid and bounded commands.
test('async commands preserve input, binary bytes and nonzero exit results', async () => {
	const adapter = new BoundedCommandAdapter();
	expect(await adapter.checked('bun', ['-e', "process.stdout.write('ready')"])).toEqual(
		Buffer.from('ready')
	);
	await expect(adapter.checked('bun', ['-e', 'process.exit(2)'])).rejects.toThrow('exit code 2');
	const result = await measureWorkload(
		'adapter.execution-runtimes-bounded-command',
		'binary-command',
		() =>
			adapter.run('bun', ['-e', 'process.stdin.pipe(process.stdout); process.exitCode = 2'], {
				input: Buffer.from([0, 255, 13])
			})
	);
	expect(result).toEqual({ code: 2, stdout: Buffer.from([0, 255, 13]), stderr: '' });
});
test('sync commands preserve exit information and enforce their limits', () => {
	const adapter = new BoundedCommandAdapter();
	expect(adapter.runSync('bun', ['-e', 'process.exit(3)']).code).toBe(3);
	expect(() =>
		adapter.runSync('bun', ['-e', 'setInterval(()=>{},100)'], { timeoutMs: 50 })
	).toThrow();
	expect(() =>
		adapter.runSync('bun', ['-e', "process.stdout.write('abc')"], { maxBuffer: 1 })
	).toThrow();
});
test('async commands stop on deadline, output overflow, cancellation or failed launch', async () => {
	const adapter = new BoundedCommandAdapter();
	await expect(
		adapter.run('bun', ['-e', 'setInterval(()=>{},100)'], { timeoutMs: 50 })
	).rejects.toThrow(/timed out/);
	await expect(
		adapter.run('bun', ['-e', "process.stderr.write('abcd')"], { maxBuffer: 2 })
	).rejects.toThrow(/output limit/);
	await expect(
		adapter.run('bun', ['-e', 'setInterval(()=>{},100)'], { signal: AbortSignal.timeout(50) })
	).rejects.toThrow();
	await expect(adapter.run('harness-nonexistent-fixture-command')).rejects.toThrow();
	expect(() => adapter.run('bun', [], { timeoutMs: Infinity })).toThrow(/positive finite/);
});
test('inherited environment includes only explicitly allowed operating-system keys', () => {
	vi.stubEnv('HARNESS_BOUNDED_SECRET_FIXTURE', 'synthetic');
	try {
		expect(commandEnvironment()).not.toHaveProperty('HARNESS_BOUNDED_SECRET_FIXTURE');
	} finally {
		vi.unstubAllEnvs();
	}
});
