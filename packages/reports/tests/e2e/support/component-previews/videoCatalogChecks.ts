import { expect } from '@playwright/test';
import type { CatalogCheckContext } from './catalogChecks.types';
import type { VideoGraphNavigationProps } from '../../../../src/components/verification-evidence/VideoGraphNavigation.types';
import { videoCatalogProps, videoFixtureFlags } from './videoCatalogVariants';

export async function assertVideoCatalogState({
	component,
	unit,
	variant
}: Pick<CatalogCheckContext, 'component' | 'unit' | 'variant'>) {
	if (unit.id === 'reports.component.verification-evidence-video-evidence') {
		if (['failed', 'empty'].includes(variant)) {
			await expect(component.locator('video')).toHaveCount(0);
			await expect(
				component.getByText(
					variant === 'failed' ? 'The recording failed.' : 'No video was recorded.',
					{ exact: true }
				)
			).toBeVisible();
			return;
		}
		await expect(component.locator('video')).toBeVisible();
		if (variant === 'error')
			await expect(component.getByRole('alert')).toHaveText(
				'Frame feedback returned no flags list.'
			);
		else await expect(component.getByRole('alert')).toHaveCount(0);
		const flags = videoFixtureFlags(variant);
		await expect(component.locator('.frame-flags li')).toHaveCount(flags.length);
		await expect(component.locator('.flag-track button')).toHaveCount(flags.length);
		for (const flag of flags)
			await expect(
				component.getByRole('button', {
					name: `${flag.status[0].toUpperCase() + flag.status.slice(1)} · ${flag.atSeconds.toFixed(2)}s`,
					exact: true
				})
			).toBeVisible();
		return;
	}
	if (unit.id !== 'reports.component.verification-evidence-video-graph-navigation') return;
	const props = videoCatalogProps(unit.id, variant) as unknown as VideoGraphNavigationProps;
	const paths = component.getByRole('combobox', { name: 'Video path' });
	if (props.library.playlists.length > 1) {
		await expect(paths).toHaveValue(props.selected ?? '');
		await expect(paths.locator('option')).toHaveCount(props.library.playlists.length + 1);
		await paths.selectOption(props.library.playlists[1].id);
		await expect(paths).toHaveValue(props.library.playlists[1].id);
		await paths.selectOption('');
		await expect(paths).toHaveValue('');
	} else await expect(paths).toHaveCount(0);
	if (!props.coverage?.length)
		await expect(component.getByText('No verified graph coverage is attached.')).toBeVisible();
	for (const graph of props.coverage ?? []) {
		const clips = graph.clips === undefined ? 'Not reported' : `${Math.round(graph.clips * 100)}%`;
		const text = `States ${Math.round(graph.states * 100)}% · Transitions ${Math.round(graph.edges * 100)}% · Clips ${clips}`;
		await expect(component.getByText(text, { exact: false })).toBeVisible();
		if (!graph.complete)
			await expect(
				component.getByText(`Missing required proof: ${graph.missing.join(', ')}`, { exact: true })
			).toBeVisible();
	}
	for (const gap of props.library.discoveryGaps ?? [])
		await expect(component.getByText(gap.reason, { exact: true })).toBeVisible();
}
