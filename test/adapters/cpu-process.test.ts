import { mkdtemp, rm } from 'node:fs/promises';
import * as os from 'node:os';
import { join } from 'node:path';
import { expect, test, vi } from 'vitest';
import { CpuProcessAdapter } from '../../src/adapters/cpu-process-adapter/CpuProcessAdapter';
import { measureWorkload } from '../support/measureWorkload';

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
		expect(sample.cpu.cores).toBeGreaterThan(0);
		expect(sample.processes.find((p) => p.pid === process.pid)?.role).toBe('harness');
		expect(
			sample.processes.every((p) =>
				Object.keys(p).every((key) => ['pid', 'parentPid', 'cpuMs', 'role', 'label'].includes(key))
			)
		).toBe(true);
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
		await expect(adapter.sample()).rejects.toThrow('CPU counters unavailable.');
		vi.mocked(os.cpus).mockReset();
		process.env.PATH = emptyPath;
		await expect(adapter.sample()).rejects.toMatchObject({ code: 'ENOENT' });
	} finally {
		if (originalPath === undefined) delete process.env.PATH;
		else process.env.PATH = originalPath;
		vi.mocked(os.platform).mockReset();
		vi.mocked(os.cpus).mockReset();
		await rm(emptyPath, { recursive: true, force: true });
	}
}
