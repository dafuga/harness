import { mkdtempSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import {
	resourceConfig,
	saveResourceConfig
} from '../../src/utils/execution-runtimes/resourceConfig';
test('machine settings retain safe defaults, persist atomically and reject invalid reserves', () => {
	const home = mkdtempSync(join(tmpdir(), 'resource-config-'));
	try {
		const config = resourceConfig(home);
		expect(config).toMatchObject({
			cpuReservePercent: 10,
			memoryReservePercent: 10,
			minMemoryReserveMiB: 2048
		});
		expect(() => saveResourceConfig({ ...config, cpuReservePercent: 0 }, home)).toThrow();
		saveResourceConfig({ ...config, cpuReservePercent: 20 }, home);
		expect(resourceConfig(home).cpuReservePercent).toBe(20);
		if (process.platform !== 'win32')
			expect(statSync(join(home, 'config.json')).mode & 0o777).toBe(0o600);
		writeFileSync(join(home, 'config.json'), '{} invalid');
		expect(() => resourceConfig(home)).toThrow();
	} finally {
		rmSync(home, { recursive: true, force: true });
	}
});
