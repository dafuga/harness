import { runtimeEvidence } from './runtime-evidence';
import { expect, test, type Page } from '../../../../test/support/browserTest';
import {
	branch,
	commits,
	evidenceCache,
	evidenceFixture,
	evidenceState,
	ids,
	sharedProject
} from './ui-evidence-fixture';
import { beta, remotePhoneFixture } from './ui-remote-phone-fixture';

/**
 * When recorded evidence is read and what is said while it is not there: it is asked for only
 * where it is shown, an answer for something no longer shown is dropped, its images are let go,
 * and a connection that cannot read it, is offline or was refused says exactly that.
 */
const short = (commit: string) => commit.slice(0, 7);
const at = (entity: string, commit?: string, suffix = '') =>
	`/projects/${sharedProject}/harness/branch/${encodeURIComponent(branch)}` +
	`${commit ? `/commit/${commit}` : ''}/${entity}${suffix}`;
const orders = `pages/${ids.page}`;
const runtime = (page: Page) => page.getByRole('region', { name: 'Recorded runtime evidence' });
const tabs = (page: Page) => page.getByRole('navigation', { name: 'Entity sections' });
const asked = async (page: Page, op: string) =>
	(await evidenceState(page)).calls.filter((call) => call.op === op);
const path = (page: Page) => new URL(page.url()).pathname;
/** Goes to an address as Back and Forward do: the page stays loaded, and what it shows changes. */
const visit = (page: Page, address: string) =>
	page.evaluate((to) => {
		history.pushState({}, '', to);
		dispatchEvent(new PopStateEvent('popstate'));
	}, address);

test('evidence is read only where it is shown, and each section has its own address', async ({
	page
}, info) => {
	await evidenceFixture(page);
	await page.goto(at(orders, undefined, '/designs'));
	await expect(page.getByRole('img', { name: 'OrdersPage v001 desktop default' })).toBeVisible();
	await expect(tabs(page).getByRole('button', { name: 'Designs' })).toHaveAttribute(
		'aria-current',
		'page'
	);
	expect(await asked(page, 'evidence')).toEqual([]);
	await tabs(page).getByRole('button', { name: 'States' }).click();
	await expect.poll(() => path(page)).toBe(at(orders, undefined, '/states'));
	await page.getByText('Verification details', { exact: true }).click();
	const coverage = page.getByRole('region', { name: 'Evidence coverage' });
	await expect(
		coverage.getByRole('heading', { name: /Orders page over synthetic orders/ })
	).toBeVisible();
	const empty = coverage.getByRole('row', { name: /^empty/ });
	await expect(empty.getByRole('button', { name: /failed/ })).toBeVisible();
	const usual = coverage.getByRole('row', { name: /^default/ });
	await expect(usual.getByRole('button', { name: /passed/ })).toBeVisible();
	await expect(coverage.getByText('orders-browser · passed')).toBeVisible();
	await runtimeEvidence(page, info, 'coverage');
	expect((await asked(page, 'evidence')).length).toBe(1);
	// The same read serves the overview: it is not asked for again.
	await tabs(page).getByRole('button', { name: 'Overview' }).click();
	await expect.poll(() => path(page)).toBe(at(orders));
	await expect(runtime(page).getByRole('figure')).toHaveCount(1);
	expect((await asked(page, 'evidence')).length).toBe(1);
	for (const [name, suffix] of [
		['Used In', '/used-in'],
		['Uses', '/uses'],
		['History', '/history']
	]) {
		await tabs(page).getByRole('button', { name }).click();
		await expect.poll(() => path(page)).toBe(at(orders, undefined, suffix));
	}
	await page
		.getByRole('navigation', { name: 'Entity sections' })
		.getByRole('button', { name: 'Source', exact: true })
		.click();
	await expect(
		page.getByRole('button', { name: 'src/routes/orders/+page.svelte', exact: true })
	).toBeVisible();
});

test('an answer for a scope or an entity that is no longer shown is dropped', async ({ page }) => {
	const slow = {
		[`${ids.page}|current|${commits.tip}`]: 1500,
		[`${ids.filter}|current|${commits.tip}`]: 1500
	};
	await evidenceFixture(page, { delay: slow });
	await page.goto(at(orders));
	const shown = runtime(page);
	await expect(shown.getByText('Reading recorded evidence…')).toBeVisible();
	await visit(page, at(orders, commits.middle));
	const older = shown.getByRole('figure', { name: `After · ${short(commits.middle)}` });
	await expect(older.getByRole('img')).toBeVisible();
	await page.waitForTimeout(2000);
	await expect(older.getByRole('img')).toBeVisible();
	await expect(shown.getByText(/Current snapshot/)).toHaveCount(0);
	expect((await asked(page, 'evidence')).map((call) => call.mode)).toEqual(['current', 'commit']);
	// The same for another entity: the function is left before its answer arrives.
	await page.goto(at(`functions/${ids.filter}`));
	await expect(shown.getByText('Reading recorded evidence…')).toBeVisible();
	await page.getByRole('link', { name: 'Components', exact: true }).click();
	await page.getByRole('link', { name: 'Open component' }).first().click();
	await expect(shown.getByRole('heading', { name: 'Current screenshot' })).toBeVisible();
	await page.waitForTimeout(2000);
	await expect(shown.getByRole('heading', { name: /end-to-end/i })).toHaveCount(0);
	await expect(shown.getByRole('heading', { name: 'Current screenshot' })).toBeVisible();
});

test('images of what is no longer shown are let go', async ({ page }) => {
	await evidenceFixture(page);
	await page.goto(at(orders, commits.tip));
	await expect(runtime(page).getByRole('img')).toHaveCount(2);
	const held = (await evidenceState(page)).urls.made;
	expect(held.length).toBeGreaterThanOrEqual(2);
	expect((await evidenceState(page)).urls.revoked).toEqual([]);
	await page.getByRole('link', { name: 'Helpers', exact: true }).click();
	await expect(page.getByRole('link', { name: 'Open function' })).toBeVisible();
	const { revoked } = (await evidenceState(page)).urls;
	expect(held.filter((url) => !revoked.includes(url))).toEqual([]);
});

test('a backend without the two reads says so, and designs are read as before', async ({
	page
}, info) => {
	await evidenceFixture(page, { reads: false });
	await page.goto(at(orders));
	const shown = runtime(page);
	await expect(
		shown.getByText('Recorded runtime evidence is not available on this connection.')
	).toBeVisible();
	await expect(shown.getByRole('img')).toHaveCount(0);
	await runtimeEvidence(page, info, 'old-host-gap');
	await expect(page.getByRole('heading', { name: 'Contract', exact: true })).toBeVisible();
	await tabs(page).getByRole('button', { name: 'Designs' }).click();
	await expect(page.getByRole('img', { name: 'OrdersPage v001 desktop default' })).toBeVisible();
	await tabs(page).getByRole('button', { name: 'States' }).click();
	await expect(
		page.getByText('Recorded runtime evidence is not available on this connection.')
	).toBeVisible();
});

test('a shared project shows the same evidence, says when it is a saved copy, and lets go when refused', async ({
	page
}, info) => {
	await evidenceFixture(page, { shared: true });
	await page.goto(at(orders));
	const shown = runtime(page);
	await expect(shown.getByRole('figure').getByRole('img')).toBeVisible();
	await expect(shown.getByText(/saved copy/i)).toHaveCount(0);
	await expect(page.getByText('Shared project · GitHub · read-only')).toBeVisible();
	const saved = '2026-10-12T08:00:00.000Z';
	await evidenceCache(page, { projectId: sharedProject, status: 'offline', cachedAt: saved });
	await expect(shown.getByText(/Saved copy.*not checked with the server/)).toBeVisible();
	await expect(shown.getByRole('figure').getByRole('img')).toBeVisible();
	await runtimeEvidence(page, info, 'shared-saved');
	const held = (await evidenceState(page)).urls.made;
	await evidenceCache(page, { projectId: sharedProject, status: 'denied' });
	await expect(page.getByText(/Access to this shared project ended/)).toBeVisible();
	await expect(shown).toHaveCount(0);
	const { revoked } = (await evidenceState(page)).urls;
	expect(held.filter((url) => !revoked.includes(url))).toEqual([]);
});

test('a phone shows the same overview, and says that its connection does not read evidence', async ({
	page
}, info) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await remotePhoneFixture(page, 'online');
	await page.goto(`/projects/${beta}/harness/branch/main/components/component%3Abutton`);
	await expect(tabs(page).getByRole('button')).toHaveText([
		'Overview',
		'Designs',
		'Used In',
		'Uses',
		'States',
		'History',
		'Source'
	]);
	await expect(page.getByRole('heading', { name: 'Contract', exact: true })).toBeVisible();
	await expect(
		runtime(page).getByText('Recorded runtime evidence is not available on this connection.')
	).toBeVisible();
	const overflow = await page.evaluate(
		() => document.documentElement.scrollWidth - document.documentElement.clientWidth
	);
	expect(overflow).toBeLessThanOrEqual(0);
	await runtimeEvidence(page, info, 'phone-gap');
});
