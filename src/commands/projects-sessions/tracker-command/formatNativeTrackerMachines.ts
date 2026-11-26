import type { Summary, NativeTrackerMachines } from './formatNativeTrackerMachines.types';
// @harness-uid u_2njoexd2vc
import type {
	TrackerPlacement,
	TrackerProcessGroup
} from '../../../utils/projects-sessions/trackerMachine.types';

export function formatNativeTrackerMachines(data: NativeTrackerMachines): string {
	if (Array.isArray(data)) return data.map(formatMachine).join('\n');
	const { sample, history } = data;
	const lines = [formatMachine(data)];
	for (const [title, groups] of [
		['top CPU', sample?.top_cpu],
		['top memory', sample?.top_rss]
	] as const)
		if (groups?.length) lines.push(`  ${title}:`, ...groups.map(formatGroup));
	lines.push(`  history: ${history.length} five-minute sample(s)`);
	for (const entry of history)
		lines.push(
			`    ${entry.at}  load ${entry.load.join('/')}  RAM ${entry.ram.available_pct}% free  swap ${entry.swap.used_mb} MB`
		);
	return lines.join('\n');
}

function formatMachine(row: Summary): string {
	const lines = [`${row.node}  ${row.status.toUpperCase()}  (${row.role})`];
	const { cores, load, ram, swap, disks, agents } = row;
	if (cores && load && ram && swap && agents) {
		const volumes = (disks ?? [])
			.map((disk) => `${disk.mount} ${disk.free_gb}/${disk.total_gb} GB free`)
			.join(', ');
		lines.push(
			`  ${cores} cores, load ${load.join('/')}; RAM ${round(ram.available_mb / 1024)}/${round(ram.total_mb / 1024)} GB free (${ram.pressure_free_pct ?? ram.available_pct}%); swap ${swap.used_mb} MB`,
			`  disk ${volumes || 'unknown'}`,
			`  agents: ${agents.claude} Claude, ${agents.codex} Codex, ${agents.test_runners} test runner(s), ${agents.browsers} browser(s); sampled ${row.age_s}s ago`
		);
	}
	for (const reason of row.reasons) lines.push(`  - ${reason}`);
	return lines.join('\n');
}

function formatGroup(group: TrackerProcessGroup): string {
	return `    ${group.label}: cpu ${group.cpu}%, ${group.rss_mb} MB, ${group.procs} procs`;
}

export function formatNativeTrackerPlacement(placement: TrackerPlacement): string {
	const lines = [
		`${placement.recommended ? `use ${placement.recommended}` : 'no computer has room'} (${placement.kind}, needs ${placement.needs_ram_gb} GB)`
	];
	for (const entry of placement.ranked) {
		const score = entry.score === null ? '' : `, score ${entry.score}`;
		lines.push(`  ${entry.node}: ${entry.fits ? 'fits' : 'does not fit'}${score}`);
		for (const reason of entry.reasons) lines.push(`    - ${reason}`);
	}
	return lines.join('\n');
}

function round(value: number): number {
	return Math.round(value * 10) / 10;
}
