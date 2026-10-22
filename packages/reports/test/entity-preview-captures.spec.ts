import { expect, test } from '../../../test/support/browserTest';
import { capture, open, ready } from './entityPreviewPage';
import { commits, ids } from './entityUnits';

const page = { category: 'pages' as const, entity: ids.page };
const shots = '.ex-evidence .ex-shot img';

test('screenshots use their capture commit and comparisons show their paired revisions', async ({
	page: tab
}) => {
	await open(tab, page);
	await expect(tab.getByRole('heading', { name: 'Current screenshot' })).toBeVisible();
	await expect(tab.locator(shots)).toHaveCount(1);
	await expect(tab.locator(shots)).toHaveAttribute('src', '/media/ccccccc-default-desktop.png');
	await expect(tab.locator('.ex-pane figcaption strong')).toHaveText('ccccccc');
	await capture(tab, 'page-current-desktop');
	await tab.getByRole('button', { name: 'Mobile' }).click();
	await expect(tab.locator(shots)).toHaveAttribute('src', '/media/ccccccc-default-mobile.png');
	await expect(tab.getByRole('combobox', { name: 'State' })).toHaveCount(0);
	await open(tab, { category: 'components', entity: ids.card }, 'inherited');
	await expect(tab.getByRole('heading', { name: 'Current screenshot' })).toBeVisible();
	await ready(tab);
	await expect(tab.locator(shots)).toHaveAttribute('src', '/media/bbbbbbb-default-desktop.png');
	await expect(tab.locator('.ex-pane figcaption strong')).toHaveText('bbbbbbb');
	await capture(tab, 'component-current-inherited-desktop');
	await tab.getByRole('button', { name: 'Mobile' }).click();
	await expect(tab.locator(shots)).toHaveAttribute('src', '/media/bbbbbbb-default-mobile.png');
	await expect(tab.locator('.ex-pane figcaption strong')).toHaveText('bbbbbbb');
	await capture(tab, 'component-current-inherited-mobile');
	await open(tab, { ...page, commit: commits.middle });
	await expect(tab.getByRole('heading', { name: 'Commit comparison' })).toBeVisible();
	const sources = () =>
		tab.locator(shots).evaluateAll((all) => all.map((image) => image.getAttribute('src')));
	expect(await sources()).toEqual([
		'/media/aaaaaaa-default-desktop.png',
		'/media/bbbbbbb-default-desktop.png'
	]);
	await capture(tab, 'page-commit-desktop');
	await tab.getByRole('button', { name: 'Mobile' }).click();
	expect(await sources()).toEqual([
		'/media/aaaaaaa-default-mobile.png',
		'/media/bbbbbbb-default-mobile.png'
	]);
	const image = tab.locator('.ex-evidence .ex-shot').last();
	await image.click();
	await expect(tab.getByRole('dialog')).toBeVisible();
	await tab.keyboard.press('Escape');
	await expect(tab.getByRole('dialog')).toHaveCount(0);
	await image.focus();
	await image.press('Enter');
	await expect(tab.getByRole('dialog')).toBeVisible();
});
