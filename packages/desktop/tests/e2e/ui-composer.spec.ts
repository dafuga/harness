import { expect, test, type Locator, type Page } from '../../../../test/support/browserTest';
import { designOptionsFixture } from './ui-design-options-fixture';
import { activity, at, modes, option, optionGroup } from './ui-design-options-helpers';
import { bubble, laptop, openProjectChat, pageRoute, panel, phone } from './ui-composer-fixture';

/**
 * One composer: modes in one canonical order, one focus ring, and the Project chat as a phone
 * bottom sheet over a scrim that leaves the page behind inert. Design Options toggles show only the
 * chosen option gold. SYNTHETIC fixture: no agent runs.
 */
const canonical = ['Comment', 'Ask', 'Plan', 'Change'];
const slogan = 'Ask a question, plan a design, or request a code change.';

const field = (scope: Page | Locator) =>
	scope.getByRole('textbox', { name: 'Message', exact: true });

async function modeLabels(page: Page) {
	const labels = (await modes(page).getByRole('button').allTextContents()).map((s) => s.trim());
	return labels;
}

/** A colour in the one form every browser reports alike, whichever notation it was written in. */
async function normalColour(page: Page, value: string) {
	return page.evaluate((css) => {
		const context = document.createElement('canvas').getContext('2d');
		if (!context) throw new Error('No canvas to normalise a colour');
		context.fillStyle = css;
		return context.fillStyle;
	}, value);
}

/** The painted colour a CSS value takes, read from a probe. */
async function probe(page: Page, value: string) {
	return normalColour(
		page,
		await page.evaluate((cssValue) => {
			const node = document.createElement('div');
			node.style.background = cssValue;
			document.body.append(node);
			const painted = getComputedStyle(node).backgroundColor;
			node.remove();
			return painted;
		}, value)
	);
}

async function openDesignConversation(page: Page, size: typeof laptop) {
	await page.setViewportSize(size);
	await designOptionsFixture(page);
	await page.goto(at(activity));
	await option(page, 2).click();
	if (size.width <= 850) {
		await page
			.getByRole('navigation', { name: 'Entity sections' })
			.getByRole('button', { name: 'Conversation', exact: true })
			.click();
	}
	await expect(page.getByRole('button', { name: 'Approve v003', exact: true })).toBeVisible();
}

test('both composers list their modes in the canonical order', async ({ page }) => {
	await openDesignConversation(page, laptop);
	const design = await modeLabels(page);
	expect(design.length).toBeGreaterThan(1);
	expect(design).toEqual(canonical.filter((mode) => design.includes(mode)));

	await openProjectChat(page, laptop, false);
	const project = await modeLabels(page);
	expect(project.length).toBeGreaterThan(1);
	expect(project).toEqual(canonical.filter((mode) => project.includes(mode)));
});

test('the focused field has one outline and the composer frame has none', async ({ page }) => {
	await openDesignConversation(page, laptop);
	const field_ = field(page.locator('.thread-panel'));
	await field_.focus();
	const gold = await probe(page, 'var(--hx-color-primary)');
	const paint = await field_.evaluate((node) => {
		const composer = node.closest('.composer');
		if (!composer) throw new Error('No composer around the field');
		const style = getComputedStyle(composer);
		const own = getComputedStyle(node);
		return {
			frameBorder: style.borderTopColor,
			frameShadow: style.boxShadow,
			frameOutline: style.outlineStyle,
			fieldOutline: own.outlineStyle,
			fieldOutlineWidth: own.outlineWidth
		};
	});
	const frame = { ...paint, frameBorder: await normalColour(page, paint.frameBorder) };
	expect(frame.frameShadow).toBe('none');
	expect(frame.frameOutline).toBe('none');
	expect(frame.frameBorder).not.toBe(gold);
	expect(frame.fieldOutline).not.toBe('none');
	expect(frame.fieldOutlineWidth).not.toBe('0px');
});

test('the Project chat header is the title and close only; the slogan is the empty field hint', async ({
	page
}) => {
	await openProjectChat(page, laptop);
	await expect(
		panel(page).getByRole('heading', { name: 'Project chat', exact: true })
	).toBeVisible();
	await expect(panel(page).getByText(slogan, { exact: true })).toHaveCount(0);
	await expect(field(panel(page))).toHaveAttribute('placeholder', slogan);
	await expect(panel(page).getByRole('button', { name: 'Close chat', exact: true })).toBeVisible();
});

test('on a phone the Project chat is a bottom sheet over a scrim, and the page behind is inert', async ({
	page
}) => {
	await openProjectChat(page, phone);
	await expect(page.locator('.floating-chat-scrim')).toBeVisible();
	const box = await panel(page).boundingBox();
	if (!box) throw new Error('The Project chat sheet has no box');
	expect(box.x).toBeLessThanOrEqual(1);
	expect(box.width).toBeGreaterThanOrEqual(phone.width - 2);
	expect(Math.abs(box.y + box.height - phone.height)).toBeLessThanOrEqual(1);
	const behind = await page.evaluate(() => {
		const outside = [...document.querySelectorAll('button')].filter(
			(button) => !button.closest('.floating-chat')
		);
		return { count: outside.length, inert: outside.every((b) => b.closest('[inert]') !== null) };
	});
	expect(behind.count).toBeGreaterThan(0);
	expect(behind.inert).toBe(true);
	await expect(panel(page).getByRole('button', { name: 'Close chat', exact: true })).toBeVisible();
	await page.locator('.floating-chat-scrim').click({ position: { x: 10, y: 10 } });
	await expect(panel(page)).toBeHidden();
});

test('the chosen design option is outlined gold and Default reads as secondary', async ({
	page
}) => {
	await page.setViewportSize(laptop);
	await designOptionsFixture(page);
	await page.goto(at(activity));
	await option(page, 2).click();
	await page.mouse.move(0, 0);
	const gold = await probe(page, 'var(--hx-color-primary)');
	const secondary = await probe(page, 'var(--hx-color-surface-raised)');
	const painted = async (name: number) =>
		option(page, name).evaluate((node) => {
			const style = getComputedStyle(node);
			return {
				pressed: node.getAttribute('aria-pressed'),
				background: style.backgroundColor,
				border: style.borderTopColor,
				color: style.color
			};
		});
	const normal = async (paint: {
		pressed: string | null;
		background: string;
		border: string;
		color: string;
	}) => ({
		...paint,
		background: await normalColour(page, paint.background),
		border: await normalColour(page, paint.border),
		color: await normalColour(page, paint.color)
	});
	const chosen = await normal(await painted(2));
	expect(chosen.pressed).toBe('true');
	// Outlined, not filled: the screen keeps one filled primary button.
	expect(chosen.border).toBe(gold);
	expect(chosen.color).toBe(gold);
	expect(chosen.background).not.toBe(gold);
	for (const other of [1, 3]) {
		const plain = await normal(await painted(other));
		expect(plain.pressed).toBe('false');
		expect(plain.background).toBe(secondary);
		expect(plain.background).not.toBe(gold);
		expect(plain.border).not.toBe(gold);
		expect(plain.color).not.toBe(chosen.color);
	}
	const single = page.getByRole('group', { name: 'Image state', exact: true }).getByRole('button');
	await expect(single).toHaveCount(1);
	const only = await normal(
		await single.evaluate((node) => {
			const style = getComputedStyle(node);
			return {
				pressed: node.getAttribute('aria-pressed'),
				background: style.backgroundColor,
				border: style.borderTopColor,
				color: style.color
			};
		})
	);
	expect(only.background).toBe(secondary);
	expect(only.border).not.toBe(gold);
	expect(only.color).not.toBe(gold);
	await expect(optionGroup(page)).toBeVisible();
});
