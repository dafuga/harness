import { runtimeEvidence } from './runtime-evidence';
import { reviewRegression } from './ui-regression-fixture';
import { expect, test, type Page } from '../../../../test/support/browserTest';
import {
	branch,
	cardScenario,
	commits,
	evidenceFixture,
	evidenceState,
	ids,
	planningCommit,
	sharedProject
} from './ui-evidence-fixture';

/**
 * What an address, a name and a status say of an entity: the address decides the section also
 * when the entity stays the same, a commit is a link only where the branch is shown to contain
 * it, the status beside the name is the verdict of the record that was read, and a capture is
 * never said to have been made where it was only inherited.
 */
const short = (commit: string) => commit.slice(0, 7);
const root = `/projects/${sharedProject}/harness/branch/${encodeURIComponent(branch)}`;
const at = (entity: string, commit?: string, suffix = '') =>
	`${root}${commit ? `/commit/${commit}` : ''}/${entity}${suffix}`;
const filter = `functions/${ids.filter}`;
const orders = `pages/${ids.page}`;
const runtime = (page: Page) => page.getByRole('region', { name: 'Recorded runtime evidence' });
const tabs = (page: Page) => page.getByRole('navigation', { name: 'Entity sections' });
const current = (page: Page) => tabs(page).locator('[aria-current="page"]');
const path = (page: Page) => new URL(page.url()).pathname;
/** The mark beside the name of the entity, by what it says. */
const status = (page: Page) => page.locator('.entity-heading .verification');
/** Goes to an address as Back and Forward do: the page stays loaded, and what it shows changes. */
const visit = (page: Page, address: string) =>
	page.evaluate((to) => {
		history.pushState({}, '', to);
		dispatchEvent(new PopStateEvent('popstate'));
	}, address);

test('the address decides the section, also when the entity stays the same', async ({ page }) => {
	await evidenceFixture(page);
	await page.goto(at(filter, undefined, '/history'));
	await expect(page.getByRole('heading', { name: 'Entity history' })).toBeVisible();
	await visit(page, at(filter));
	await expect(current(page)).toHaveText('Overview');
	await expect(runtime(page)).toBeVisible();
	await expect(page.getByRole('heading', { name: 'Entity history' })).toHaveCount(0);
	await visit(page, at(filter, undefined, '/designs'));
	await expect(current(page)).toHaveText('Plan');
	await visit(page, at(filter));
	await expect(current(page)).toHaveText('Overview');
	// Details is left with its address: the section that is named next is shown without it.
	await visit(page, at(filter, undefined, '/details'));
	await expect(page.getByRole('heading', { name: 'Source files', exact: true })).toBeVisible();
	await visit(page, at(filter, undefined, '/evidence'));
	await expect(current(page)).toHaveText('Examples');
	// Helper Examples now includes its verification coverage directly.
	await expect(page.getByRole('region', { name: 'Evidence coverage' })).toBeVisible();
	await expect(page.getByRole('heading', { name: 'Source files', exact: true })).toHaveCount(0);
	// A section chosen on the page has its address, and Details closes when another is chosen.
	await expect(page.getByRole('button', { name: 'Details →', exact: true })).toHaveCount(0);
	await tabs(page).getByRole('button', { name: 'Source', exact: true }).click();
	await expect.poll(() => path(page)).toBe(at(filter, undefined, '/source'));
	await tabs(page).getByRole('button', { name: 'Used In' }).click();
	await expect.poll(() => path(page)).toBe(at(filter, undefined, '/used-in'));
	await expect(page.getByRole('heading', { name: 'Source files', exact: true })).toHaveCount(0);
});

test('going to the tip from a named commit leaves the commit, as it did before', async ({
	page
}) => {
	await evidenceFixture(page);
	await page.goto(at(filter, commits.middle, '/history'));
	await page.getByRole('button', { name: 'Go to tip', exact: true }).click();
	await expect.poll(() => path(page)).toBe(`${root}/functions`);
	await page.getByRole('link', { name: /^Open filterOrders\(/ }).click();
	await expect.poll(() => path(page)).toBe(at(filter));
	await expect(current(page)).toHaveText('Overview');
	await expect(
		runtime(page).getByRole('heading', { name: 'Current end-to-end behavior' })
	).toBeVisible();
});

test('a commit of the history is a link only where the shown branch is known to contain it', async ({
	page
}) => {
	await evidenceFixture(page);
	await page.goto(at(filter, undefined, '/history'));
	const history = page.getByRole('main');
	const proved = history.getByRole('link', { name: `Show at commit ${short(commits.middle)}` });
	await expect(proved).toHaveAttribute('href', at(filter, commits.middle));
	await expect(history.getByText(short(planningCommit))).toBeVisible();
	await expect(history.getByRole('link', { name: new RegExp(short(planningCommit)) })).toHaveCount(
		0
	);
	// The same entity at that commit, on its overview: the history it was opened from is left.
	await proved.click();
	await expect.poll(() => path(page)).toBe(at(filter, commits.middle));
	await expect(current(page)).toHaveText('Overview');
	await expect(page.getByRole('heading', { name: 'Entity history' })).toHaveCount(0);
	const after = runtime(page).getByRole('group', { name: `After · ${short(commits.middle)}` });
	await expect(after).toBeVisible();
});

test('regression history links the committed failing test and unchanged passing fix', async ({
	page
}, info) => {
	await reviewRegression(page, info);
});

test('the status beside the name is the verdict of the record that was read, or says why there is none', async ({
	page
}, info) => {
	const slow = { [`${ids.card}|current|${commits.tip}`]: 1500 };
	await evidenceFixture(page, { delay: slow });
	await page.goto(at(filter));
	await expect(status(page)).toHaveAccessibleName('Full coverage passed');
	await expect(status(page)).toHaveText('✓');
	await page.goto(at(orders));
	await expect(status(page)).toHaveAccessibleName(/^Verification failed: /);
	await expect(status(page)).toHaveText('×');
	await page.goto(at(orders, commits.first));
	await expect(status(page)).toHaveAccessibleName(
		'Evidence missing: No verification record is attached to this commit.'
	);
	await runtimeEvidence(page, info, 'status-missing');
	// While it is read nothing is known, and what was not read leaves what the catalog said.
	await page.goto(at(`components/${ids.card}`));
	await expect(status(page)).toHaveAccessibleName('Reading recorded evidence…');
	await page.goto(at(orders, undefined, '/designs'));
	await expect(status(page)).toHaveAccessibleName('No verification recorded for this revision.');
	expect((await evidenceState(page)).calls.filter((call) => call.op === 'evidence')).toEqual([]);
});

test('a backend that cannot read evidence leaves the status unknown and says so', async ({
	page
}) => {
	await evidenceFixture(page, { reads: false });
	await page.goto(at(filter));
	await expect(status(page)).toHaveAccessibleName(
		'Recorded runtime evidence is not available on this connection.'
	);
	await expect(status(page)).toHaveText('×');
});

test('a capture is said to be recorded for the tip, and made where it was made', async ({
	page
}) => {
	await evidenceFixture(page);
	await page.goto(at(`components/${ids.card}`));
	const shown = runtime(page);
	await expect(
		shown.getByText('Recorded for ccccccc and captured from the build of that commit.')
	).toBeVisible();
	await shown.getByLabel('Scenario', { exact: true }).selectOption(cardScenario);
	await expect(
		shown.getByText('Recorded for ccccccc. The capture was made at bbbbbbb and is inherited.')
	).toBeVisible();
	await expect(
		shown.getByText(/captured (at|from) the (branch tip|build of that commit)/)
	).toHaveCount(0);
	// A state whose capture was rejected has none that stands for the tip.
	await shown.getByLabel('Scenario', { exact: true }).selectOption('orders-page');
	await shown.getByLabel('State', { exact: true }).selectOption('empty');
	await shown
		.getByRole('group', { name: 'Viewport' })
		.getByRole('button', { name: 'mobile' })
		.click();
	await expect(
		shown.getByText('Recorded for ccccccc; no capture of this state stands for it.')
	).toBeVisible();
});

test('an entity is named in words, and a page states its address as a fact', async ({ page }) => {
	await evidenceFixture(page);
	await page.goto(`${root}/pages`);
	await expect(
		page.getByRole('heading', { level: 2, name: 'Orders page', exact: true })
	).toBeVisible();
	await page.getByRole('link', { name: 'Open Orders page' }).click();
	await expect(
		page.getByRole('heading', { level: 1, name: 'Orders page', exact: true })
	).toBeVisible();
	await expect(page.getByRole('link', { name: 'pages › Orders page' })).toBeVisible();
	const route = page.locator('.entity-heading').getByText('App route', { exact: true });
	await expect(route).toBeVisible();
	await expect(page.locator('.entity-heading code')).toHaveText('/orders');
	await page.goto(at(filter));
	await expect(
		page.getByRole('heading', { level: 1, name: 'Filter orders', exact: true })
	).toBeVisible();
	await expect(page.locator('.entity-heading').getByText('App route')).toHaveCount(0);
});
