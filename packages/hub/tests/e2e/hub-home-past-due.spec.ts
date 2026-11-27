import { expect, test } from '../../../../test/support/browserTest';
import type { HomeRun } from '../../../reports/src/lib/projects-sessions/hub-home/hubHome.types';
import { hubHomeFixture } from './hub-home-fixture';
import { homeClock } from './hub-home-fixture-data';

const hours = (count: number) => new Date(homeClock + count * 3_600_000).toISOString();

function run(id: string, title: string, at: string, patch: Partial<HomeRun> = {}): HomeRun {
	return {
		id,
		title,
		at,
		agent: 'harness',
		machine: 'Primary Mac',
		source: 'tracker',
		recurring: false,
		paused: false,
		whenDue: { state: 'queued', reason: null, urgency: 1 },
		...patch
	};
}

const overdue = [
	run('queued-new', 'Synthetic: bump the pinned runtime', hours(-30)),
	run('queued-old', 'Synthetic: clear the CI baseline', hours(-200)),
	run('blocked', 'Synthetic: create the sandbox webhook', hours(-220), {
		paused: true,
		whenDue: { state: 'blocked', reason: 'Automatic launch is off', urgency: 1 }
	})
];

for (const viewport of [
	{ id: 'phone', width: 390, height: 844 },
	{ id: 'laptop', width: 1440, height: 900 }
]) {
	test(`Hub home never lists past work as scheduled (${viewport.id})`, async ({
		page
	}, testInfo) => {
		await page.setViewportSize(viewport);
		await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
		const fixture = await hubHomeFixture(page, 'default');
		fixture.snapshot.overdue = overdue;
		// An older Mac app still sends a past run inside the schedule, with no state.
		fixture.snapshot.scheduled = [
			run('legacy', 'Synthetic: legacy past run', hours(-100), { whenDue: undefined }),
			run('future', 'Synthetic: tomorrow morning check', hours(11))
		];
		fixture.snapshot.providers.routines = null;
		await page.goto('/');

		const scheduled = page.getByRole('region', { name: 'Scheduled', exact: true });
		await expect(scheduled.getByText('Synthetic: tomorrow morning check')).toBeVisible();
		for (const past of [...overdue, { title: 'Synthetic: legacy past run' }])
			await expect(scheduled.getByText(past.title)).toHaveCount(0);
		await expect(page.getByText(/routine dates are unknown/)).toHaveCount(0);

		const work = page.getByRole('region', { name: 'Work in progress', exact: true });
		await expect(work).not.toContainText(/overdue \d/i);
		const waiting = work.getByRole('region', { name: 'Past due, not started' });
		await expect(waiting).toContainText('2 queued · 2 blocked');
		await expect(waiting.getByRole('listitem').first()).toContainText(
			'Synthetic: clear the CI baseline'
		);
		await expect(waiting.getByRole('listitem').first()).toContainText('Queued #1');
		await expect(waiting.getByRole('listitem').nth(1)).toContainText('Queued #2');
		await expect(waiting).toContainText('Automatic launch is off');
		await expect(waiting).toContainText('has not reported why');

		await scheduled.screenshot({ path: testInfo.outputPath(`scheduled-card-${viewport.id}.png`) });
		await work.screenshot({ path: testInfo.outputPath(`work-card-${viewport.id}.png`) });
		await scheduled.getByRole('button', { name: /^(See all|All \d+)/ }).click();
		const dialog = page.getByRole('dialog', { name: 'Scheduled', exact: true });
		await expect(dialog.getByText('Synthetic: tomorrow morning check')).toBeVisible();
		await expect(dialog.getByText('Synthetic: legacy past run')).toHaveCount(0);
		await dialog.screenshot({ path: testInfo.outputPath(`scheduled-dialog-${viewport.id}.png`) });
	});
}
