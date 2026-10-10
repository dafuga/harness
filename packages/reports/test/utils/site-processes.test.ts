import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, expect, test, vi } from 'vitest';
import type { CpuSnapshot } from '../../../../src/utils/cpuMetrics';

const root = mkdtempSync(join(tmpdir(), 'harness-site-processes-'));
const git = (cwd: string, args: string[]) =>
	execFileSync('git', ['-c', 'user.name=F', '-c', 'user.email=f@h.invalid', ...args], {
		cwd,
		stdio: 'pipe'
	});
function repository(name: string): string {
	git(root, ['init', '-q', '-b', 'main', name]);
	writeFileSync(join(root, name, 'README.md'), name);
	git(join(root, name), ['add', '-A']);
	git(join(root, name), ['-c', 'commit.gpgsign=false', 'commit', '-q', '-m', name]);
	return join(root, name);
}
let site: string;
let other: string;
beforeAll(() => {
	[site, other] = [repository('site'), repository('other')];
	mkdirSync(join(site, 'packages'));
	vi.stubEnv('HARNESS_SITE_ROOT', site);
});
afterAll(() => rmSync(root, { recursive: true, force: true }));

const group = (id: string, machinePercent: number, processes: number) => ({
	id,
	label: id,
	corePercent: machinePercent * 8,
	machinePercent,
	processes
});
const agent = (pid: number, machinePercent: number) => ({
	pid,
	label: `agent ${pid}`,
	corePercent: machinePercent * 8,
	machinePercent,
	processes: 2
});
const sample: CpuSnapshot = {
	status: 'available',
	sampledAt: '2026-10-10T20:00:00.000Z',
	intervalMs: 250,
	logicalCores: 8,
	machinePercent: 40,
	trackedPercent: 17,
	groups: [group('codex', 5, 3), group('harness', 2, 1), group('agents', 10, 6)],
	agents: [agent(11, 4), agent(22, 5), agent(33, 1)]
};

test('only agents working in this site are listed, and the machine total stays the machine', async () => {
	const { siteProcesses } = await import('../../src/utils/siteProcesses');
	const directories = new Map([
		[11, join(site, 'packages')],
		[22, other]
	]);
	const scoped = siteProcesses(sample, (pid) => directories.get(pid));
	// The agent in the other application and the one whose directory is unknown are left out.
	expect(scoped.agents.map((item) => item.pid)).toEqual([11]);
	expect(scoped.groups.find((item) => item.id === 'agents')).toMatchObject({
		machinePercent: 4,
		corePercent: 32,
		processes: 2
	});
	expect(scoped.machinePercent).toBe(40);
	expect(scoped.groups.find((item) => item.id === 'codex')).toEqual(sample.groups[0]);
	expect(scoped.trackedPercent).toBe(11);
	expect(siteProcesses(sample, () => undefined).agents).toEqual([]);
});
