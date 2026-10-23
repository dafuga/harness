import { expect, test } from 'vitest';
import {
	linuxMemory,
	macMemory
} from '../../src/services/execution-runtimes/resource-queue-service/resource-monitor-service/host-resources-adapter/hostMemory';
const vm =
	'Mach Virtual Memory Statistics: (page size of 16384 bytes)\nPages free: 100.\nPages active: 9000.\nPages inactive: 200.\nPages speculative: 30.\nPages purgeable: 100.\n';
test('macOS uses reclaimable counters and its pressure alarm, not the active working set', () => {
	expect(macMemory(vm, '1', 1e9)).toEqual({
		memoryTotalBytes: 1e9,
		memoryAvailableBytes: 330 * 16384,
		memoryPressure: 'normal'
	});
	expect(macMemory(vm, '2', 1e9).memoryPressure).toBe('warning');
	expect(macMemory(vm, '4', 1e9).memoryPressure).toBe('critical');
	expect(macMemory(vm, '0', 1e9).memoryPressure).toBe('unknown');
	expect(() => macMemory('unreadable', '1', 1e9)).toThrow();
});
test('Linux uses MemAvailable, so cached pages are not mistaken for unavailable RAM', () => {
	expect(
		linuxMemory('MemTotal: 8000000 kB\nMemFree: 100 kB\nMemAvailable: 4000000 kB\n')
	).toMatchObject({ memoryAvailableBytes: 4000000 * 1024, memoryPressure: 'normal' });
	expect(() => linuxMemory('MemFree: 100 kB')).toThrow();
});
