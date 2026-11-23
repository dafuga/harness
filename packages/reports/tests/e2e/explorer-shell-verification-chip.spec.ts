import type { Locator, Page } from '@playwright/test';
import { expect, test } from '../../../../test/support/browserTest';
import { screens } from './support/sharedSelect';
import { styled } from './support/shellChecks';
import { buildShellFixture, openShellPage, removeShellFixture } from './support/shellFixture';

/**
 * The verification mark of a card or an entity header. A verification nobody recorded is a muted
 * outlined chip that says so in words; only a failed verification is drawn in the danger colour.
 */
let home = '';

test.beforeAll(() => {
	test.setTimeout(180_000);
	home = buildShellFixture(['primitives']);
});
test.afterAll(() => removeShellFixture(home));

/** The colour a design token paints, as the browser computes it for this page. */
async function tokenColour(page: Page, token: string): Promise<string> {
	return page.evaluate((name) => {
		const probe = document.createElement('span');
		probe.style.color = `var(${name})`;
		document.body.append(probe);
		const colour = getComputedStyle(probe).color;
		probe.remove();
		return colour;
	}, token);
}

/** Every colour a mark paints: its text, its background and its outline, each of its parts. */
const painted = (mark: Locator) =>
	mark.evaluate((root) =>
		[root, ...root.querySelectorAll('*')].flatMap((element) => {
			const style = getComputedStyle(element);
			return [style.color, style.backgroundColor, style.borderTopColor];
		})
	);

for (const [screen, width, height] of screens) {
	test(`a verification nobody recorded is a muted 'Not verified' chip, red only for a failure at ${screen} width`, async ({
		page
	}) => {
		await page.setViewportSize({ width, height });
		await openShellPage(page, home, 'primitives');
		const group = page.getByLabel('Verifications');
		const [unrecorded, failed, passed] = [
			group.getByRole('button', { name: 'Nothing was recorded for this revision.' }),
			group.getByRole('button', { name: 'Test login is failing.' }),
			group.getByRole('button', { name: 'Every test passed at this revision.' })
		];
		// The absence is written out in words, with no icon in front of it.
		await expect(unrecorded).toHaveText('Not verified');
		await expect(unrecorded.locator('svg')).toHaveCount(0);
		expect(await styled(unrecorded, 'border-top-style')).toBe('solid');
		// Its outline and text are the muted token; no part of it is painted in the danger colour.
		const [danger, muted, success] = [
			await tokenColour(page, '--hx-color-error'),
			await tokenColour(page, '--hx-color-text-muted'),
			await tokenColour(page, '--hx-color-success')
		];
		expect(await painted(unrecorded)).not.toContain(danger);
		expect(await styled(unrecorded, 'color')).toBe(muted);
		expect(await styled(unrecorded, 'border-top-color')).toBe(muted);
		// What is missing is still said when the mark is pointed at; a mark below the fold is brought
		// to the middle of the screen first, so the pointer meets it where it is.
		await unrecorded.evaluate((mark) =>
			mark.scrollIntoView({ block: 'center', behavior: 'instant' })
		);
		const at = await unrecorded.boundingBox();
		await page.mouse.move(1, 1);
		await page.mouse.move(at!.x + at!.width / 2, at!.y + at!.height / 2);
		await expect(group.getByText('Nothing was recorded for this revision.')).toBeVisible();
		// A failure is the only one drawn in red, and a pass in green.
		await expect(failed).toHaveText('×');
		expect(await styled(failed, 'background-color')).toBe(danger);
		await expect(passed).toHaveText('✓');
		expect(await styled(passed, 'background-color')).toBe(success);
	});
}
