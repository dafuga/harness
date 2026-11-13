import { EventEmitter } from 'node:events';
import { spawn } from 'node:child_process';
import { afterEach, expect, test, vi } from 'vitest';
import { PreviewWorkerService } from '../../packages/reports/src/lib/development-tooling/preview-node/preview-worker-service/PreviewWorkerService';
import { readPreviewHealth } from '../../packages/reports/src/lib/development-tooling/preview-node/preview-worker-service/previewHealth';
vi.mock('node:child_process', () => ({ spawn: vi.fn() }));
vi.mock(
	'../../packages/reports/src/lib/development-tooling/preview-node/preview-worker-service/previewHealth',
	() => ({ readPreviewHealth: vi.fn() })
);
afterEach(() => {
	vi.restoreAllMocks();
	vi.unstubAllEnvs();
});
// Initial service method matrix exercises launch and intentional shutdown at a mocked process boundary.
test('start passes only required environment to the worker and close stops it', async () => {
	vi.stubEnv('HARNESS_SECRET_FIXTURE', 'synthetic');
	vi.stubEnv('HARNESS_CONSOLE_DATA', 'fixture-history');
	const child = Object.assign(new EventEmitter(), {
		pid: 123,
		exitCode: null,
		signalCode: null,
		kill: vi.fn(() => {
			child.emit('exit', 0);
			return true;
		})
	});
	vi.mocked(spawn).mockReturnValue(child as unknown as ReturnType<typeof spawn>);
	vi.mocked(readPreviewHealth).mockResolvedValue({
		protocol: 'harness-worker-v1',
		pid: 123,
		errors: 0,
		busy: false
	});
	const service = new PreviewWorkerService('fixture.mjs', [], 'http://127.0.0.1:12345');
	const handle = await service.start();
	try {
		const options = vi.mocked(spawn).mock.calls[0][2];
		expect(Object.hasOwn(options?.env ?? {}, 'HARNESS_SECRET_FIXTURE')).toBe(false);
		expect(options?.env).toMatchObject({ HARNESS_CONSOLE_DATA: 'fixture-history' });
		expect(options?.env?.HARNESS_PREVIEW_WORKER_TOKEN).toEqual(expect.any(String));
	} finally {
		await handle.close();
	}
	expect(child.kill).toHaveBeenCalledWith('SIGTERM');
});
