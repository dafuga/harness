// @harness-uid u_q6vu4wcrvc
import type { HomeComputer } from '$reports/lib/projects-sessions/hub-home/homeLive.types';
import type { StripComputer } from './hubStripComputers.types';

const HIGH_LOAD_PERCENT = 85;
const BUSY_LOAD_PERCENT = 70;

/** @pure One strip entry per computer, in the order given. */
export function stripComputers(machines: HomeComputer[]): StripComputer[] {
	return machines.map(stripComputer);
}

function stripComputer(machine: HomeComputer): StripComputer {
	if (machine.status === 'offline') return offlineEntry(machine);
	const load = computerLoad(machine);
	const { state, tone } = stateFor(machine.status, load);
	return {
		name: machine.name,
		tone,
		state,
		load,
		sub: detailLine(sessionCount(machine), load),
		short: loadLabel(load)
	};
}

function offlineEntry(machine: HomeComputer): StripComputer {
	return {
		name: machine.name,
		tone: 'blocked',
		state: 'Offline',
		load: null,
		sub: machine.reasons?.[0] ?? 'Not reachable',
		short: 'Offline'
	};
}

function computerLoad(machine: HomeComputer): number | null {
	const cpu = machine.utilization?.actual.cpu;
	if (isNumber(cpu)) return clampPercent(cpu);
	const loadOne = machine.resources?.loadOne;
	const cores = machine.resources?.cores;
	if (!isNumber(loadOne) || !isNumber(cores) || cores <= 0) return null;
	return clampPercent((loadOne / cores) * 100);
}

function isNumber(value: unknown): value is number {
	return typeof value === 'number' && Number.isFinite(value);
}

function clampPercent(value: number): number {
	return Math.min(100, Math.max(0, Math.round(value)));
}

function stateFor(
	status: HomeComputer['status'],
	load: number | null
): Pick<StripComputer, 'state' | 'tone'> {
	if (status === 'overloaded' || atOrAbove(load, HIGH_LOAD_PERCENT)) {
		return { state: 'High load', tone: 'warn' };
	}
	if (status === 'busy' || atOrAbove(load, BUSY_LOAD_PERCENT)) {
		return { state: 'Busy', tone: 'active' };
	}
	return { state: 'Healthy', tone: 'done' };
}

function atOrAbove(load: number | null, threshold: number): boolean {
	return load !== null && load >= threshold;
}

function sessionCount(machine: HomeComputer): number | null {
	return machine.agentCount ?? machine.remoteRuns ?? null;
}

function detailLine(sessions: number | null, load: number | null): string {
	const sessionPart = sessions === null ? null : sessionLabel(sessions);
	return [sessionPart, loadLabel(load)].filter((part) => part !== null).join(' · ');
}

function sessionLabel(count: number): string {
	return count === 1 ? '1 session' : `${count} sessions`;
}

function loadLabel(load: number | null): string {
	return load === null ? 'Load unknown' : `${load}% load`;
}
