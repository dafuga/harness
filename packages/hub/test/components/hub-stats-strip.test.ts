import { render } from 'svelte/server';
import HubStatsStrip from '../../../reports/src/components/projects-sessions/hub-home/HubStatsStrip.svelte';
import { expect, test } from 'vitest';
import type { StripComputer } from '../../../reports/src/components/projects-sessions/hub-home/hubStripComputers.types';
import type { StripCounts } from '../../../reports/src/components/projects-sessions/hub-home/hubStripCounts.types';
import type { StripQuota } from '../../../reports/src/components/projects-sessions/hub-home/hubStripQuota.types';

const computers: StripComputer[] = [
	{
		name: 'Studio Mac',
		tone: 'active',
		state: 'Busy',
		load: 64,
		sub: '4 sessions · 64% load',
		short: '64% load'
	},
	{
		name: 'Build Box',
		tone: 'done',
		state: 'Healthy',
		load: null,
		sub: '1 session · load unknown',
		short: 'Load unknown'
	}
];

const quota: StripQuota[] = [
	{
		provider: 'claude',
		name: 'Claude',
		window: '5 hour',
		left: 64,
		tone: 'active',
		resets: 'resets 21:10'
	},
	{
		provider: 'codex',
		name: 'Codex',
		window: 'weekly',
		left: null,
		tone: 'warn',
		resets: 'No recent reading'
	}
];

const counts: StripCounts = {
	sessions: { label: 'Sessions running', value: 5, sub: '3 Claude · 2 Codex' },
	needsYou: { label: 'Needs you', value: 3, sub: 'Oldest waiting 2h 14m' }
};

type StripProps = Partial<{
	computers: StripComputer[];
	counts: StripCounts;
	compact: boolean;
	pressed: 'sessions' | 'needs-you' | null;
}>;

function renderStrip(props: StripProps): string {
	return render(HubStatsStrip, {
		props: { computers, quota, counts, ...props }
	}).body;
}

/** Text of the first element whose class list starts with `className`. */
function textOf(body: string, className: string): string | undefined {
	return body.match(new RegExp(`class="${className}[^"]*">([^<]*)<`))?.[1];
}

function pressedCount(body: string): number {
	return body.match(/aria-pressed="true"/g)?.length ?? 0;
}

test('desktop strip is labelled Overview and shows both count tiles', () => {
	const body = renderStrip({});
	expect(body).toContain('aria-label="Overview"');
	expect(body).toContain('Sessions running');
	expect(body).toContain('3 Claude · 2 Codex');
	expect(body).toContain('Needs you');
	expect(body).toContain('Oldest waiting 2h 14m');
	expect(textOf(body, 'hs-num')).toBe('5');
	expect(body).not.toContain('hs-cells');
});

test('only the pressed tile reports aria-pressed true', () => {
	const sessionsBody = renderStrip({ pressed: 'sessions' });
	expect(pressedCount(sessionsBody)).toBe(1);
	expect(sessionsBody).toMatch(
		/aria-pressed="true"[^>]*>\s*<span class="hs-kicker[^"]*">Sessions running/
	);

	const needsBody = renderStrip({ pressed: 'needs-you' });
	expect(pressedCount(needsBody)).toBe(1);
	expect(needsBody).toMatch(/aria-pressed="true"[^>]*>\s*<span class="hs-kicker[^"]*">Needs you/);

	expect(pressedCount(renderStrip({ pressed: null }))).toBe(0);
});

test('needs-you tile is flagged only above zero', () => {
	expect(renderStrip({})).toContain('hs-needs');
	const zeroBody = renderStrip({
		counts: {
			sessions: counts.sessions,
			needsYou: { label: 'Needs you', value: 0, sub: 'Nothing waiting' }
		}
	});
	expect(zeroBody).not.toContain('hs-needs');
});

test('each computer shows its name, state word, sub line and tone', () => {
	const body = renderStrip({});
	expect(body).toContain('Studio Mac');
	expect(body).toContain('Busy');
	expect(body).toContain('4 sessions · 64% load');
	expect(body).toContain('data-tone="active"');
	expect(body).toContain('Build Box');
	expect(body).toContain('Healthy');
	expect(body).toContain('1 session · load unknown');
	expect(body).toContain('data-tone="done"');
});

test('load meters expose the value, or unknown without a reading', () => {
	const body = renderStrip({});
	expect(body).toContain('aria-label="Studio Mac load"');
	expect(body).toContain('aria-valuenow="64"');
	expect(body).toContain('aria-valuetext="64%"');
	expect(body).toContain('aria-label="Build Box load"');
	expect(body).toContain('aria-valuetext="unknown"');
	expect(body).not.toContain('aria-valuenow="null"');
});

test('quota shows percent left with reset time, or the reading gap', () => {
	const body = renderStrip({});
	expect(body).toContain('64% left · resets 21:10');
	expect(body).toContain('aria-label="Claude 5 hour left"');
	expect(body).toContain('aria-label="Codex weekly left"');
	expect(body).toContain('No recent reading');
	expect(body).toContain('aria-valuetext="unknown"');
});

test('an empty computer list says no computers are linked', () => {
	const body = renderStrip({ computers: [] });
	expect(body).toContain('No computers linked');
	expect(body).not.toContain('Studio Mac');
	expect(body).not.toContain('load"');
});

test('compact layout shows four cells and one chip per computer', () => {
	const body = renderStrip({ compact: true, pressed: 'needs-you' });
	expect(body).toContain('hs-compact');
	expect(body).toContain('hs-cells');
	expect(body).toContain('Sessions');
	expect(body).toContain('Need you');
	expect(body).toContain('Claude left');
	expect(body).toContain('Codex left');
	expect(body).toMatch(/class="hs-cell-num[^"]*">64%</);
	expect(body).toMatch(/class="hs-cell-num[^"]*">–</);
	expect(body).toContain('hs-needs');
	expect(body).toContain('64% load');
	expect(body).toContain('Load unknown');
	expect(body).not.toContain('hs-stat');
	expect(body).not.toContain('Computers</');
});
