import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, test } from 'vitest';
import { hostResourceLimits } from '../src/services/execution-runtimes/resource-queue-service/resource-monitor-service/host-resources-adapter/hostResourceLimits';
const roots: string[] = [];
afterEach(() => roots.splice(0).forEach((root) => rmSync(root, { recursive: true, force: true })));
function fixture() {
	const root = mkdtempSync(join(tmpdir(), 'resource-cgroup-'));
	roots.push(root);
	const membership = join(root, 'membership');
	writeFileSync(membership, '0::/parent/child');
	writeFileSync(join(root, 'cgroup.controllers'), 'cpu memory');
	mkdirSync(join(root, 'parent/child'), { recursive: true });
	return {
		root,
		membership,
		put: (path: string, value: string) => writeFileSync(join(root, path), value)
	};
}
test('hierarchical cgroup quotas retain the tightest CPU and memory headroom', () => {
	const f = fixture();
	f.put('parent/cpu.max', '200000 100000');
	f.put('parent/cpu.stat', 'usage_usec 3000');
	f.put('parent/child/cpu.max', '400000 100000');
	f.put('parent/child/cpu.stat', 'usage_usec 1000');
	f.put('parent/memory.max', '8000');
	f.put('parent/memory.current', '7000');
	f.put('parent/child/memory.max', '4000');
	f.put('parent/child/memory.current', '1000');
	expect(hostResourceLimits(f.root, f.membership, 'linux')).toEqual({
		cores: 2,
		cpuUsedUs: 3000,
		memoryTotalBytes: 4000,
		memoryAvailableBytes: 1000
	});
});
test('invalid quotas, unsupported cgroups and parent traversal fail closed', () => {
	const f = fixture();
	f.put('parent/child/cpu.max', 'bad 100000');
	expect(() => hostResourceLimits(f.root, f.membership, 'linux')).toThrow('Invalid CPU quota');
	f.put('membership', '0::/../escape');
	expect(() => hostResourceLimits(f.root, f.membership, 'linux')).toThrow('Invalid cgroup path');
	expect(() => hostResourceLimits(join(f.root, 'missing'), f.membership, 'linux')).toThrow(
		'cgroup v2'
	);
	expect(hostResourceLimits(f.root, f.membership, 'darwin')).toEqual({});
});
