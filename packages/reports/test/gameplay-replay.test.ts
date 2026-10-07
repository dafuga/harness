import { afterEach, expect, test, vi } from 'vitest';
import { render } from 'svelte/server';
import ReportView from '../src/components/ReportView.svelte';
import type { Report } from '../src/models/Report.types';
const report: Report = {
	schemaVersion: 1,
	id: 'fixture',
	project: { id: 'game', name: 'Fatebound', path: '/tmp/game' },
	title: 'Fresh game replay',
	mode: 'feature',
	environment: 'fixture',
	historical: false,
	startedAt: '2026-09-30T12:00:00Z',
	updatedAt: '2026-09-30T12:00:00Z',
	summary: 'Screenshot replay fixture',
	status: 'running',
	state: 'active',
	checks: [],
	findings: [],
	coverage: [],
	acceptance: [],
	evidence: [
		{
			id: 'one',
			title: 'Scene 01 — Tavern',
			category: 'Gameplay',
			file: 'one.jpg',
			status: 'passed',
			order: 1
		}
	]
};
afterEach(() => vi.useRealTimers());
test('a screenshot report offers playback, speed, seeking and live recording state', () => {
	vi.useFakeTimers();
	vi.setSystemTime(new Date('2026-09-30T12:01:00Z'));
	const { body } = render(ReportView, {
		props: { report, assetBase: '/assets/', downloadBase: '/exports/' }
	});
	expect(body).toContain('Gameplay replay');
	expect(body).toContain('Play replay');
	expect(body).toContain('Playback speed');
	expect(body).toContain('Replay timeline');
	expect(body).toContain('Recording');
	const speed = body.match(
		/<select[^>]*aria-label="Playback speed"[^>]*>([\s\S]*?)<\/select>/
	)?.[1];
	const scene = body.match(/<select[^>]*aria-label="Jump to scene"[^>]*>([\s\S]*?)<\/select>/)?.[1];
	expect(speed).toContain('<option value="1" selected');
	expect(scene).toContain('<option value="1" selected');
});
test('a fresh game report starts on scene one while retaining its setup frame', () => {
	const withSetup = {
		...report,
		evidence: [
			{ ...report.evidence[0], id: 'setup', title: 'Create your hero', order: 0 },
			...report.evidence
		]
	};
	const { body } = render(ReportView, {
		props: { report: withSetup, assetBase: '/assets/', downloadBase: '/exports/' }
	});
	const scene = body.match(/<select[^>]*aria-label="Jump to scene"[^>]*>([\s\S]*?)<\/select>/)?.[1];
	expect(scene).toContain('<option value="1" selected');
	expect(body).toContain('Frame 2 of 2');
	expect(body).toContain('aria-label="Previous frame"');
});
