import { expect, type Locator } from '@playwright/test';
import { desktopFixtureCommits as commits } from './desktopFixtureCommits';

async function assertPickerReview(component: Locator, id: string, variant: string) {
	if (id === 'desktop.component.project-switcher') {
		if (['open', 'shared'].includes(variant)) {
			await expect(
				component.getByRole('listbox', { name: 'Project', exact: true }),
				'Opening a project picker displays its choices'
			).toBeVisible();
			await expect(
				component.getByRole('option', { name: 'Orders', exact: true }),
				'An opened project list paints its available project'
			).toBeVisible();
		}
		if (variant === 'empty') {
			await expect(
				component.getByText('No projects yet', { exact: true }),
				'An empty project picker has a visible explanation'
			).toBeVisible();
			await expect(
				component.getByRole('listbox'),
				'An empty project picker explains the absence instead of a disabled empty field'
			).toHaveCount(0);
			await expect(component.getByRole('combobox')).toHaveCount(0);
		}
		if (variant === 'busy') {
			await expect(component.getByRole('button', { name: 'Choose workbench' })).toBeDisabled();
			await expect(
				component.getByRole('status'),
				'Busy project switching has a visible status'
			).toContainText('Loading project');
		}
	}
	if (id === 'desktop.component.revision-picker' && variant.endsWith('-open'))
		await expect(
			component.getByRole('listbox'),
			'Opening a revision picker displays its choices'
		).toBeVisible();
	if (['desktop.component.project-gate', 'desktop.component.project-switcher'].includes(id)) {
		await expect(component).not.toContainText(/Preview project|Shared workbench|A workbench with/);
		await expect(component.getByText('preview', { exact: true })).toHaveCount(0);
	}
}

export async function assertPickerPresentation(component: Locator, id: string, variant: string) {
	await assertPickerReview(component, id, variant);
	await assertPickerFrame(component, id, variant);
	if (id === 'desktop.component.project-gate') await assertGatePresentation(component, variant);
	if (id === 'desktop.component.revision-picker')
		await assertRevisionPresentation(component, variant);
	if (id === 'desktop.component.game-view-fields' && variant === 'multiple') {
		await expect(
			component.getByRole('combobox', { name: 'View', exact: true }),
			'Multiple-view capture shows the selected second level'
		).toHaveValue('second-level');
		await expect(component.getByRole('textbox', { name: 'View title', exact: true })).toHaveValue(
			'Garden return route'
		);
	}
	if (id === 'desktop.component.revision-picker' && variant === 'historical')
		await expect(
			component.locator('[aria-label="Viewed context"] strong'),
			'Historical revision names the older selected commit'
		).toContainText(commits.middle.slice(0, 7));
	if (id !== 'desktop.component.project-switcher') return;
	if (variant === 'shared') {
		const project = component.getByRole('listbox', { name: 'Project', exact: true });
		await expect(project, 'Shared project is selected in the visible picker').toHaveValue(
			'shared-project'
		);
		await expect(project.locator('option:checked')).toHaveText('Orders Operations');
	}
	if (variant === 'busy') {
		await expect(component.getByRole('dialog')).toHaveCount(0);
		const add = component.getByRole('button', { name: 'Add local project', exact: true });
		await expect(add).toBeVisible();
		await expect(add).toBeDisabled();
	}
}

async function assertGatePresentation(component: Locator, variant: string) {
	await expect(component).not.toContainText('Recent activity is ready to review.');
	if (variant !== 'busy') return;
	const opening = component.getByRole('button', { name: 'Opening project…', exact: true });
	await expect(opening, 'Opening a project is visibly busy').toBeVisible();
	await expect(opening).toBeDisabled();
	await expect(opening).toHaveAttribute('aria-busy', 'true');
}

async function assertRevisionContextFits(summary: Locator) {
	const complete = await summary
		.locator('strong')
		.evaluate((node) => node.scrollWidth <= node.clientWidth);
	expect(complete, 'Complete revision context fits without clipping').toBe(true);
}

async function assertRevisionLabelFits(button: Locator) {
	const fits = await button.evaluate((node) => {
		const label = node.querySelector('span');
		if (!label) return false;
		const range = document.createRange();
		range.selectNodeContents(label);
		const text = range.getBoundingClientRect();
		const bounds = node.getBoundingClientRect();
		return (
			range.getClientRects().length === 1 &&
			text.width > 0 &&
			text.left >= bounds.left &&
			text.right <= bounds.right &&
			Math.abs(text.top + text.height / 2 - bounds.top - bounds.height / 2) <= 4
		);
	});
	expect(fits, 'Revision trigger text is centered and fits').toBe(true);
}

async function assertRevisionPresentation(component: Locator, variant: string) {
	for (const word of ['Branch', 'Commit']) {
		const button = component.getByRole('button', {
			name: `Choose ${word.toLowerCase()}`,
			exact: true,
			includeHidden: true
		});
		await expect(button, 'Revision triggers have visible words').toContainText(word);
		await assertRevisionLabelFits(button);
		await expect(button.locator('svg'), 'Revision triggers retain their icons').toBeVisible();
	}
	const summary = component.getByLabel('Viewed context');
	await assertRevisionContextFits(summary);
	if (variant === 'environment') {
		await expect(summary).toContainText('preprod');
		await expect(summary.locator('time')).toHaveAttribute('datetime', '2026-10-20T10:00:00Z');
	}
	if (variant === 'pinned') {
		await expect(summary).toContainText('Pinned');
		await expect(
			component.getByRole('button', { name: 'Follow branch', exact: true })
		).toBeVisible();
	}
	if (variant !== 'historical') {
		await expect(component.getByRole('button', { name: 'Go to tip', exact: true })).toHaveCount(0);
		return;
	}
	await expect(summary).toContainText('Historical');
	const tip = component.getByRole('button', { name: 'Go to tip', exact: true });
	await expect(tip).toBeVisible();
	const ordinary = component.getByRole('button', {
		name: 'View branch',
		exact: true,
		includeHidden: true
	});
	for (const property of ['color', 'border-color'])
		await expect(
			tip,
			'Revision navigation uses the same neutral treatment at every viewport'
		).toHaveCSS(
			property,
			await ordinary.evaluate(
				(node, name) => getComputedStyle(node).getPropertyValue(name),
				property
			)
		);
}

async function assertPickerFrame(component: Locator, id: string, variant: string) {
	if (!['desktop.component.project-switcher', 'desktop.component.revision-picker'].includes(id))
		return;
	if (
		id.endsWith('project-switcher') &&
		variant === 'long' &&
		component.page().viewportSize()!.width > 560
	) {
		const fits = await component
			.locator('.project-name')
			.evaluate((node) => node.scrollWidth <= node.clientWidth);
		expect(fits, 'Project names use available desktop and tablet width').toBe(true);
	}
	if (variant === 'open' || variant === 'shared' || variant.endsWith('-open')) {
		await expect(
			component.locator('button.agent-icon').first(),
			'An opened picker retains its trigger context'
		).toBeVisible();
		for (const field of await component.getByRole('listbox').all()) {
			const fits = await field.evaluate((node: HTMLSelectElement) => {
				const style = getComputedStyle(node),
					canvas = document.createElement('canvas');
				const context = canvas.getContext('2d')!;
				context.font = style.font;
				const width =
					node.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
				return [...node.options].every((option) => context.measureText(option.text).width <= width);
			});
			expect(fits, 'Choice labels fit the open native field without clipping').toBe(true);
		}
	}
	if (id.endsWith('revision-picker')) {
		const buttons = component.locator('.revision-choices > button');
		const first = (await buttons.nth(0).boundingBox())!,
			second = (await buttons.nth(1).boundingBox())!;
		expect(
			second.x - first.x - first.width,
			'Revision triggers have a visible gap'
		).toBeGreaterThanOrEqual(6);
	}
}
