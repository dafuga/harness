import type { CatalogCheckContext } from './catalogChecks.types';
import { expect } from '../../../../../../test/support/browserTest';
import * as preview from './previewPage';

export async function captureCatalogBeforeActions(
	{ page, component, unit, variant, viewport }: CatalogCheckContext,
	home: string
) {
	const { id } = unit;
	const target = { viewport: viewport.id, variant };
	const early =
		[
			'reports.component.explorer-ui-explorer-kit-pill',
			'reports.component.shared-primitives-atoms-html-a',
			'reports.component.shared-primitives-atoms-html-ol',
			'reports.component.shared-primitives-atoms-html-li',
			'reports.component.shared-primitives-atoms-html-ul',
			'reports.component.shared-primitives-atoms-html-table',
			'reports.component.shared-primitives-atoms-html-thead',
			'reports.component.shared-primitives-atoms-html-tbody',
			'reports.component.shared-primitives-atoms-html-tr',
			'reports.component.shared-primitives-atoms-html-th',
			'reports.component.shared-primitives-atoms-html-td'
		].includes(id) ||
		(variant === 'empty' &&
			[
				'reports.component.coverage-list',
				'reports.component.module-system-plugins-plugin-steps'
			].includes(id));
	if (early) {
		if (id === 'reports.component.coverage-list')
			await expect(component.getByRole('heading', { name: 'Acceptance' })).toBeVisible();
		await preview.capturePreview(page, home, id, target);
	}
	return early;
}
