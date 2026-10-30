import { expect, type Locator } from '@playwright/test';

const kit = 'reports.component.explorer-ui-explorer-kit-';
const plugins = 'reports.component.module-system-plugins-';
const checks: Record<string, (component: Locator, variant: string) => Promise<void>> = {
	[`${kit}card`]: card,
	[`${kit}pill`]: pill,
	[`${kit}empty-state`]: empty,
	[`${kit}notice`]: notice,
	[`${kit}command-block`]: command,
	[`${plugins}explorer-plugin-card`]: plugin,
	[`${plugins}plugin-resource-card`]: resource,
	[`${plugins}plugin-state-pills`]: states,
	[`${plugins}plugin-steps`]: steps
};

/** Public semantics and visible state are asserted inside the standard responsive catalog case. */
export async function assertPluginKitPreview(component: Locator, id: string, variant: string) {
	await checks[id]?.(component, variant);
}

/** Standalone inline labels retain their content width, as they do inside plugin cards. */
export async function assertInlinePluginKitCapture(component: Locator, id: string) {
	if (![`${kit}pill`, `${plugins}plugin-state-pills`].includes(id)) return;
	for (const pill of await component.locator('.ex-pill').all()) {
		const excess = await pill.evaluate((node) => {
			const range = document.createRange();
			range.selectNodeContents(node);
			const style = getComputedStyle(node);
			const edges = ['paddingLeft', 'paddingRight', 'borderLeftWidth', 'borderRightWidth']
				.map((key) => Number.parseFloat(style[key as keyof CSSStyleDeclaration] as string))
				.reduce((sum, value) => sum + value, 0);
			return node.getBoundingClientRect().width - range.getBoundingClientRect().width - edges;
		});
		expect(
			excess,
			'An inline badge must fit its label rather than stretch across the fixture'
		).toBeLessThanOrEqual(2);
	}
}

async function card(component: Locator, variant: string) {
	const tag = variant === 'section' ? 'section' : 'article';
	const root = component.locator(`${tag}.ex-card`);
	await expect(root).toBeVisible();
	await expect(root.getByRole('heading')).toHaveText(
		variant === 'section' ? 'Plugin setup' : 'OrderList'
	);
	if (variant === 'section')
		await expect(root).toHaveAttribute('aria-labelledby', 'kit-card-title');
	if (variant === 'tone') await expect(root).toHaveClass(/mod-card/);
	await expect(root.locator('p')).toContainText(
		variant === 'section' ? 'Configure' : 'current orders'
	);
}

async function pill(component: Locator, variant: string) {
	const root = component.locator('.ex-pill');
	await expect(root).toHaveText(variant === 'state' ? 'Available' : 'Installed');
	if (variant)
		await expect(root).toHaveAttribute(
			'data-state',
			variant === 'state' ? 'Available' : 'Installed'
		);
	else await expect(root).not.toHaveAttribute('data-state');
	if (variant === 'tone') await expect(root).toHaveClass(/mod-state/);
}

async function empty(component: Locator, variant: string) {
	await expect(component.locator('p.ex-empty')).toContainText('No dependencies recorded');
	const action = component.getByRole('link', { name: 'Browse components' });
	await expect(action).toHaveCount(variant === 'action' ? 1 : 0);
	if (variant === 'action') {
		await expect(action).toHaveAttribute('href', '/harness/components');
		await action.focus();
		await expect(action).toBeFocused();
	}
}

async function notice(component: Locator) {
	const root = component.getByRole('note');
	await expect(root).toContainText('Some dependencies could not be read');
	expect(await root.evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(true);
}

async function command(component: Locator, variant: string) {
	const root = component.locator('figure.ex-command');
	await expect(root.locator('figcaption')).toHaveText('Install');
	await expect(root.locator('code')).toContainText('harness plugin add');
	if (variant === 'multiline')
		await expect(root.locator('code')).toContainText('harness plugin generate');
	if (variant === 'long')
		expect((await root.locator('code').innerText()).length).toBeGreaterThan(300);
	expect(await root.locator('pre').evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(
		true
	);
}

async function states(component: Locator, variant: string) {
	const labels: Record<string, string> = { included: 'Included', available: 'Available' };
	const label = labels[variant.split('-')[0]] ?? 'Installed';
	const badge = component.locator('.mod-state');
	await expect(badge).toHaveText(label);
	await expect(badge).toHaveAttribute('data-state', label);
	await expect(component.getByText('Testing', { exact: true })).toHaveCount(
		variant.endsWith('-testing') ? 1 : 0
	);
	await expect(badge).toHaveCSS('border-top-style', label === 'Available' ? 'dashed' : 'solid');
}

async function plugin(component: Locator, variant: string) {
	await states(component, variant);
	await expect(component.getByRole('heading', { name: 'Email', exact: true })).toBeVisible();
	await expect(component.getByRole('link', { name: 'Email', exact: true })).toHaveAttribute(
		'href',
		'/plugins/email'
	);
	const available = variant.startsWith('available');
	await expect(component.locator('.ex-command')).toHaveCount(available ? 1 : 0);
	await expect(
		component.getByRole('list', { name: 'Email resource types' }).locator('li')
	).toHaveCount(variant === 'empty-resources' ? 0 : 1);
}

async function resource(component: Locator, variant: string) {
	await expect(component.getByRole('heading', { name: 'Emails', exact: true })).toBeVisible();
	await expect(component.locator('figcaption')).toHaveText(
		variant === 'available' ? 'Generate, once installed' : 'Generate'
	);
	await expect(component.locator('code')).toHaveText('harness plugin generate email email Example');
	await expect(component.locator('.mod-steps li')).toHaveCount(
		variant === 'empty-instructions' ? 0 : 1
	);
}

async function steps(component: Locator, variant: string) {
	await expect(component.locator('.mod-steps')).toBeAttached();
	const counts: Record<string, number> = { empty: 0, long: 1 };
	await expect(component.locator('.mod-steps li')).toHaveCount(counts[variant] ?? 2);
	if (variant === 'long')
		await expect(component.locator('li')).toContainText('SERVER_ONLY_ENVIRONMENT_');
	if (variant === 'multiline')
		await expect(component.locator('li').first()).toContainText('Then run its tests.');
}
