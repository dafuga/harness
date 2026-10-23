import { expect, test, type Page } from '../../../../test/support/browserTest';
import { hostedFixture } from './ui-hosted-fixture';
import { capture, scenario } from './ui-reference-capture';
import {
	alpha,
	alphaThread,
	earlier,
	emitRun,
	gamma,
	referenceFixture
} from './ui-references-fixture';

/**
 * References at every width and in every place: a long unknown reference wraps as text on a
 * phone, streamed text and progress link when whole, a pinned commit is kept, a shared project
 * links in comments only, another tab leaves the thread and its draft in place, and the project
 * agent says its public reply with links. Each state is captured once its checks have passed.
 */
const alphaAt = (rest: string) => `/projects/${alpha}/harness/branch/feat%2Falpha/${rest}`;
const designs = 'pages/page%3Aactivity/designs';
const thread = (page: Page) => page.getByRole('complementary', { name: 'Design conversation' });
const long = `[[unit:app.function.${'unresolved-'.repeat(14)}end]]`;
const asked = `Can ${long} replace [[unit:app.function.format-time]]?`;

/** The reference fixture with one more agent question in the thread of Alpha. */
async function seeded(page: Page) {
	await referenceFixture(page);
	const message = {
		...{ id: 'agent-long', at: 'Today', author: 'agent', text: asked, mode: 'plan' },
		...{ provider: 'codex', model: 'fixture', version: 'v002', imageSha256: 'b'.repeat(64) }
	};
	await page.addInitScript(
		({ id, said }) => {
			const host = window as unknown as {
				__projects: { data: { projects: Array<{ messages: Record<string, unknown[]> }> } };
			};
			host.__projects.data.projects[0].messages[id].push(said);
		},
		{ id: alphaThread, said: message }
	);
}

async function openThread(page: Page, at = alphaAt(designs), said = /keep the filters/) {
	await page.goto(at);
	await page.getByRole('button', { name: 'Open thread 1', exact: true }).click();
	const toggle = page.getByRole('button', { name: 'Conversation', exact: true });
	if (await toggle.isVisible()) await toggle.click();
	await expect(thread(page).getByText(said)).toBeVisible();
}

for (const viewport of scenario.viewports) {
	test(`${viewport.id}: a long unknown reference wraps as text beside a linked unit`, async ({
		page
	}, info) => {
		await page.setViewportSize({ width: viewport.width, height: viewport.height });
		await seeded(page);
		await openThread(page);
		const question = thread(page).getByText('replace', { exact: false });
		await question.scrollIntoViewIfNeeded();
		await expect(question).toHaveText(`Can ${long} replace Format time?`);
		await expect(question.getByRole('link')).toHaveCount(1);
		await expect(question.getByRole('link', { name: 'Format time', exact: true })).toBeVisible();
		const box = (await question.boundingBox())!;
		expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
		expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
			true
		);
		await capture(page, info, 'question');
	});
}

test('a reference opened in a new tab leaves the thread and its draft in place', async ({
	page
}) => {
	await seeded(page);
	await openThread(page);
	const draft = page.getByRole('textbox', { name: 'Message', exact: true });
	await draft.fill('Draft about the frame');
	const link = thread(page).getByRole('link', { name: 'Order frame', exact: true });
	const [opened] = await Promise.all([
		page.context().waitForEvent('page'),
		link.click({ modifiers: ['ControlOrMeta'] })
	]);
	await expect(opened).toHaveURL(alphaAt('layouts/app.shell.order-frame'));
	await expect(page).toHaveURL(alphaAt(designs));
	await expect(thread(page)).toBeVisible();
	await expect(draft).toHaveValue('Draft about the frame');
});

test('the project agent says its public reply with the units it names as links', async ({
	page
}, info) => {
	await referenceFixture(page);
	await page.goto(alphaAt('pages'));
	await page.getByRole('button', { name: 'Work with agent', exact: true }).click();
	const agent = page.getByRole('complementary', { name: 'Project agent', exact: true });
	await agent.getByRole('textbox', { name: 'Message', exact: true }).fill('Add a refunds page');
	await agent.getByRole('button', { name: 'Send plan', exact: true }).click();
	// Events are heard once the run is known by its id.
	await expect(agent.getByRole('status')).toHaveText(/Request accepted/);
	await emitRun(page, { kind: 'status', phase: 'prompting', detail: 'Asking codex' });
	await emitRun(page, { kind: 'text', text: 'Should the page reuse [[unit:app.shell.order' });
	await emitRun(page, { kind: 'text', text: '-frame]] or [[unit:app.function.missing]]?' });
	const reply = agent.getByText('Should the page reuse', { exact: false });
	await expect(reply).toHaveText(
		'Agent: Should the page reuse Order frame or [[unit:app.function.missing]]?'
	);
	await expect(reply.getByRole('link', { name: 'Order frame', exact: true })).toHaveAttribute(
		'href',
		alphaAt('layouts/app.shell.order-frame/history')
	);
	await expect(reply.getByRole('link')).toHaveCount(1);
	await capture(page, info, 'agent-reply');
});

test('streamed text and run progress in a thread link the units once they are whole', async ({
	page
}, info) => {
	await seeded(page);
	await openThread(page);
	const modes = page.getByRole('group', { name: 'Request mode' });
	await modes.getByRole('button', { name: 'Plan', exact: true }).click();
	await page.getByRole('textbox', { name: 'Message', exact: true }).fill('Check the frame');
	await page.getByRole('button', { name: 'Send plan', exact: true }).click();
	const status = thread(page).getByRole('status');
	await expect(status).toHaveText(/Request accepted/);
	await emitRun(page, {
		kind: 'status',
		phase: 'prompting',
		detail: 'Reading [[unit:app.shell.order-frame]]'
	});
	await emitRun(page, {
		kind: 'text',
		text: 'Keep [[unit:app.function.format-time]] and [[unit:app.fun'
	});
	await emitRun(page, { kind: 'text', text: 'ction.missing]] as they are.' });
	const stream = thread(page).getByText('as they are', { exact: false });
	await expect(stream).toHaveText(
		'Keep Format time and [[unit:app.function.missing]] as they are.'
	);
	await expect(stream.getByRole('link')).toHaveCount(1);
	await expect(status.getByRole('link', { name: 'Order frame', exact: true })).toHaveAttribute(
		'href',
		alphaAt('layouts/app.shell.order-frame')
	);
	await capture(page, info, 'stream');
});

test('a reference read at a pinned commit opens the unit at that commit', async ({
	page
}, info) => {
	await seeded(page);
	await openThread(page, alphaAt(`commit/${earlier}/${designs}`));
	const link = thread(page).getByRole('link', { name: 'Order frame', exact: true });
	await expect(link).toHaveAttribute(
		'href',
		alphaAt(`commit/${earlier}/layouts/app.shell.order-frame`)
	);
	await expect(link).toBeVisible();
	// The pinned thread is the state; following the link afterwards leaves it.
	await capture(page, info, 'pinned');
	await link.click();
	await expect(page).toHaveURL(alphaAt(`commit/${earlier}/layouts/app.shell.order-frame`));
});

test('a shared project links a reference in a comment and offers no agent', async ({
	page
}, info) => {
	await referenceFixture(page, hostedFixture);
	await openThread(page, `/projects/${gamma}/harness/branch/main/${designs}`, /wider gutter/);
	const link = thread(page).getByRole('link', { name: 'Gamma frame', exact: true });
	await expect(link).toHaveAttribute(
		'href',
		`/projects/${gamma}/harness/branch/main/layouts/app.shell.order-frame`
	);
	await expect(page.getByRole('button', { name: 'Work with agent', exact: true })).toHaveCount(0);
	await expect(page.getByRole('button', { name: 'Plan', exact: true })).toHaveCount(0);
	await expect(link).toBeVisible();
	await capture(page, info, 'hosted-comment');
});
