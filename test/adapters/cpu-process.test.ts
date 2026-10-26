import { mkdtemp, rm } from 'node:fs/promises';
import type * as childProcess from 'node:child_process';
import * as os from 'node:os';
import { join } from 'node:path';
import { expect, test, vi } from 'vitest';
import { CpuProcessAdapter } from '../../src/adapters/cpu-process-adapter/CpuProcessAdapter';
import manifest from '../../specification/units/adapter.cpu-process.json';
import { measureWorkload } from '../support/measureWorkload';

const processFixture = vi.hoisted(() => ({ mode: 'native' }));

vi.mock('node:child_process', async (load) => {
	const actual = await load<typeof childProcess>();
	const { promisify } = await import('node:util');
	const execute = promisify(actual.execFile);
	const execFile = actual.execFile.bind(undefined);
	Object.defineProperty(execFile, promisify.custom, {
		value: (file: string, args: string[], options: childProcess.ExecFileOptions) => {
			if (processFixture.mode === 'success') return Promise.resolve({ stdout: '', stderr: '' });
			if (processFixture.mode === 'failure')
				return Promise.reject(Object.assign(new Error('ps unavailable'), { code: 'ENOENT' }));
			return execute(file, args, options);
		}
	});
	return { ...actual, execFile };
});

vi.mock('node:os', async (load) => {
	const actual = await load<typeof os>();
	return { ...actual, platform: vi.fn(actual.platform), cpus: vi.fn(actual.cpus) };
});

test('native CPU sampler reads real monotonic counters without arguments', async () => {
	const adapter = new CpuProcessAdapter();
	if (['darwin', 'linux'].includes(process.platform)) {
		const sample = await measureWorkload('adapter.cpu-process', 'native-process-sample', () =>
			adapter.sample()
		);
		expect({
			hasCores: sample.cpu.cores > 0,
			currentRole: sample.processes.find((p) => p.pid === process.pid)?.role,
			sanitizedFields: sample.processes.every((p) =>
				Object.keys(p).every((key) => ['pid', 'parentPid', 'cpuMs', 'role', 'label'].includes(key))
			)
		}).toEqual(manifest.testing.cases[0].expected.value);
	} else await expect(adapter.sample()).rejects.toThrow('Unsupported CPU process platform.');
	await samplerFailures(adapter);
});

async function samplerFailures(adapter: CpuProcessAdapter): Promise<void> {
	const originalPath = process.env.PATH;
	const emptyPath = await mkdtemp(join(os.tmpdir(), 'harness-cpu-no-ps-'));
	try {
		vi.mocked(os.platform).mockReturnValue('win32');
		await expect(adapter.sample()).rejects.toThrow('Unsupported CPU process platform.');
		vi.mocked(os.platform).mockReturnValue('linux');
		vi.mocked(os.cpus).mockReturnValue([]);
		processFixture.mode = 'success';
		await expect(adapter.sample()).rejects.toThrow('CPU counters unavailable.');
		if (['darwin', 'linux'].includes(process.platform)) {
			processFixture.mode = 'native';
			await expect(adapter.sample()).rejects.toThrow('CPU counters unavailable.');
		}
		vi.mocked(os.cpus).mockReset();
		processFixture.mode = 'failure';
		await expect(adapter.sample()).rejects.toMatchObject({ code: 'ENOENT' });
		if (['darwin', 'linux'].includes(process.platform)) {
			processFixture.mode = 'native';
			process.env.PATH = emptyPath;
			await expect(adapter.sample()).rejects.toMatchObject({ code: 'ENOENT' });
		}
	} finally {
		if (originalPath === undefined) delete process.env.PATH;
		else process.env.PATH = originalPath;
		vi.mocked(os.platform).mockReset();
		vi.mocked(os.cpus).mockReset();
		processFixture.mode = 'native';
		await rm(emptyPath, { recursive: true, force: true });
	}
}
