import { expect, test } from 'vitest';
import { stripComputers } from '../../../reports/src/components/projects-sessions/hub-home/hubStripComputers';
import type { HomeComputer } from '../../../reports/src/lib/projects-sessions/hub-home/homeLive.types';

function utilization(cpu: number): NonNullable<HomeComputer['utilization']> {
	return { actual: { cpu, ram: 40 }, target: { cpu: 80, ram: 80 } };
}

function computer(
	fields: Partial<HomeComputer> & Pick<HomeComputer, 'name' | 'status'>
): HomeComputer {
	return fields as HomeComputer;
}

test('a healthy computer shows its sessions, load and a Healthy state', () => {
	const [entry] = stripComputers([
		computer({ name: 'Desk Mac', status: 'ok', agentCount: 4, utilization: utilization(62) })
	]);
	expect(entry).toEqual({
		name: 'Desk Mac',
		tone: 'done',
		state: 'Healthy',
		load: 62,
		sub: '4 sessions · 62% load',
		short: '62% load'
	});
});

test('a busy status is shown as Busy even at low load', () => {
	const [entry] = stripComputers([
		computer({ name: 'Build Mac', status: 'busy', utilization: utilization(30) })
	]);
	expect(entry).toMatchObject({ state: 'Busy', tone: 'active', load: 30 });
});

test('a load of 70 percent is Busy when the status is ok', () => {
	const [entry] = stripComputers([
		computer({ name: 'Build Mac', status: 'ok', utilization: utilization(70) })
	]);
	expect(entry).toMatchObject({ state: 'Busy', tone: 'active', load: 70 });
});

test('an overloaded status is shown as High load even at low load', () => {
	const [entry] = stripComputers([
		computer({ name: 'Render Mac', status: 'overloaded', utilization: utilization(50) })
	]);
	expect(entry).toMatchObject({ state: 'High load', tone: 'warn', load: 50 });
});

test('a load of 85 percent is High load when the status is ok', () => {
	const [entry] = stripComputers([
		computer({ name: 'Render Mac', status: 'ok', utilization: utilization(85) })
	]);
	expect(entry).toMatchObject({ state: 'High load', tone: 'warn', load: 85 });
});

test('an offline computer shows its first reason as the detail line', () => {
	const [entry] = stripComputers([
		computer({
			name: 'Lab Mac',
			status: 'offline',
			reasons: ['Tracker did not answer', 'Sleeping']
		})
	]);
	expect(entry).toEqual({
		name: 'Lab Mac',
		tone: 'blocked',
		state: 'Offline',
		load: null,
		sub: 'Tracker did not answer',
		short: 'Offline'
	});
});

test('an offline computer without a reason says it is not reachable', () => {
	const [entry] = stripComputers([computer({ name: 'Lab Mac', status: 'offline' })]);
	expect(entry).toMatchObject({ state: 'Offline', tone: 'blocked', sub: 'Not reachable' });
});

test('load falls back to loadOne divided by cores, rounded to a whole percent', () => {
	const [entry] = stripComputers([
		computer({
			name: 'Desk Mac',
			status: 'ok',
			resources: { loadOne: 3, cores: 8 }
		})
	]);
	expect(entry).toMatchObject({ load: 38, short: '38% load', state: 'Healthy' });
});

test('load is clamped to 100 percent', () => {
	const [entry] = stripComputers([
		computer({ name: 'Render Mac', status: 'ok', utilization: utilization(130) })
	]);
	expect(entry).toMatchObject({ load: 100, state: 'High load', short: '100% load' });
});

test('a computer without a usable load reports Load unknown', () => {
	const [entry] = stripComputers([
		computer({
			name: 'Desk Mac',
			status: 'ok',
			agentCount: 2,
			resources: { loadOne: 2, cores: 0 }
		})
	]);
	expect(entry).toEqual({
		name: 'Desk Mac',
		tone: 'done',
		state: 'Healthy',
		load: null,
		sub: '2 sessions · Load unknown',
		short: 'Load unknown'
	});
});

test('a single session is written in the singular', () => {
	const [entry] = stripComputers([
		computer({ name: 'Desk Mac', status: 'ok', agentCount: 1, utilization: utilization(10) })
	]);
	expect(entry).toMatchObject({ sub: '1 session · 10% load' });
});

test('remote runs count as sessions when no agent count is given', () => {
	const [entry] = stripComputers([
		computer({ name: 'Desk Mac', status: 'ok', remoteRuns: 3, utilization: utilization(10) })
	]);
	expect(entry).toMatchObject({ sub: '3 sessions · 10% load' });
});

test('three computers keep the order they were given in', () => {
	const entries = stripComputers([
		computer({ name: 'Second Mac', status: 'busy', utilization: utilization(20) }),
		computer({ name: 'First Mac', status: 'ok', utilization: utilization(90) }),
		computer({ name: 'Third Mac', status: 'offline' })
	]);
	expect(entries.map((entry) => entry.name)).toEqual(['Second Mac', 'First Mac', 'Third Mac']);
	expect(entries.map((entry) => entry.state)).toEqual(['Busy', 'High load', 'Offline']);
});
