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
			await expect(component.getByRole('listbox', { name: 'Project', exact: true })).toBeDisabled();
			await expect(
				component.getByText('No projects yet', { exact: true }),
				'An empty project picker has a visible explanation'
			).toBeVisible();
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
		await expect(component).not.toContainText('Preview project');
		await expect(component.getByText('preview', { exact: true })).toHaveCount(0);
	}
}

export async function assertPickerPresentation(component: Locator, id: string, variant: string) {
	await assertPickerReview(component, id, variant);
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
		).toHaveText(commits.middle.slice(0, 7));
	if (id !== 'desktop.component.project-switcher') return;
	if (variant === 'shared') {
		const project = component.getByRole('listbox', { name: 'Project', exact: true });
		await expect(project, 'Shared project is selected in the visible picker').toHaveValue(
			'shared-project'
		);
		await expect(project.locator('option:checked')).toHaveText('Shared workbench');
	}
	if (variant === 'busy') {
		await expect(component.getByRole('dialog')).toHaveCount(0);
		const add = component.getByRole('button', { name: 'Add local project', exact: true });
		await expect(add).toBeVisible();
		await expect(add).toBeDisabled();
	}
}
