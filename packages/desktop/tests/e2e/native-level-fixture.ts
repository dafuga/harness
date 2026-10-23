import type { Page } from '@playwright/test';
import { expect } from '../../../../test/support/browserTest';
import { exampleDocument } from '../../../game/src/index';
import { viewSettings } from './game-unsaved-fixture';
/** Assert new-project planning, then import a legacy game for the existing native compatibility matrix. */
export async function prepareNativeLegacyGame(page: Page, dimension: string) {
	await expect(page.getByLabel('Concept', { exact: true })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Checkpoints', exact: true })).toBeDisabled();
	await page.evaluate(
		async (document) => {
			const bridge = Reflect.get(window, 'harness'),
				projectId = new URL(location.href).searchParams.get('projectId');
			const saved = await bridge.gameRead({ projectId });
			await bridge.gameSave({ projectId, document, expectedRevision: saved.revision });
		},
		exampleDocument(dimension as '2d' | '3d')
	);
	await page.reload();
	await viewSettings(page);
}
