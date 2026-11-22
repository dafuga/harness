import { expect } from '@playwright/test';
import type {
	NativeRecordingScript,
	NativeRecordingSession
} from '../../../../../../src/services/verification-evidence/NativeVideoRecorderService.types';
import {
	platformCheckpoint,
	platformLinks,
	platformNames,
	preparePlatform,
	resetPlatformBoundary,
	type PlatformVideoSetup
} from './platformVideoCheckpoint';

import type { PlatformSearchCase } from './platformSearchVideo.types';

/** A feature-local script: one finite card-set branch and its real reset interaction. */
export function record(setup: PlatformVideoSetup & { fixture: PlatformSearchCase }) {
	const { mask, query } = setup.fixture;
	return {
		prepare: ({ page }: NativeRecordingSession) => preparePlatform(page, setup),
		checkpoint: ({ page }: NativeRecordingSession) => platformCheckpoint(page),
		async perform({ page, mark }: NativeRecordingScript) {
			const search = page.getByRole('searchbox', { name: 'Search platforms' });
			await expect(search).toHaveValue('');
			await expect(platformLinks(page).first()).toBeVisible();
			await mark('state', 'ready');
			await search.fill(query);
			const names = platformNames.filter((_, index) => (mask & (1 << index)) !== 0);
			await expect(platformLinks(page)).toHaveCount(names.length);
			const first = names.length
				? page.getByRole('link', { name: `View ${names[0]} configuration`, exact: true })
				: page.getByRole('button', { name: 'Show all platforms' });
			await first.scrollIntoViewIfNeeded();
			await expect(first).toBeInViewport();
			await mark('edge', `search-${mask}`);
			await mark('state', `results-${mask}`);
			// A tall viewport path visibly visits every returned card, without changing the camera size.
			for (const name of names) {
				const card = page.getByRole('link', { name: `View ${name} configuration`, exact: true });
				await card.scrollIntoViewIfNeeded();
				await expect(card).toBeInViewport();
				await page.waitForTimeout(600);
			}
			if (!names.length) await page.waitForTimeout(600);
			if (mask === 0) await page.getByRole('button', { name: 'Show all platforms' }).click();
			else await search.fill('');
			await expect(platformLinks(page)).toHaveCount(4);
			await resetPlatformBoundary(page);
			await expect(platformLinks(page).first()).toBeVisible();
			await mark('edge', `reset-${mask}`);
			await mark('state', 'ready');
			await page.waitForTimeout(500);
		}
	};
}
