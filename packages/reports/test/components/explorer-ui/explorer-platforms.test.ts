import { expect, test } from 'vitest';
import { measureWorkload } from '../../../../../test/support/measureWorkload';
import ExplorerPlatforms from '../../../src/components/explorer-ui/ExplorerPlatforms.svelte';
import { revision } from '../../entityFixture';
import { screen, count, words } from '../../entityRender';
import { commits } from '../../entityUnits';
import { platformFixture } from '../../platformFixture';

test('the catalog lists four distinct delivery targets without screenshot placeholders', async () => {
	const body = await measureWorkload(
		'reports.component.explorer-ui-explorer-platforms',
		'render-platform-catalog',
		() =>
			screen(
				ExplorerPlatforms,
				'commit',
				{ category: 'platforms' },
				{
					head: { ...revision(commits.middle, []), platforms: platformFixture }
				}
			)
	);
	expect(count(body, /<article\b/g)).toBe(4);
	expect(words(body)).toContain('Desktop (Electron)');
	expect(words(body)).toContain('iOS');
	expect(words(body)).toContain('Android');
	expect(words(body)).toContain('Web');
	expect(count(body, /<img\b/g)).toBe(0);
	expect(body).toContain(`/commit/${commits.middle}/platforms/ios`);
});

test('platform declarations remain readable without a source-unit registry', () => {
	const head = revision(commits.middle, []);
	const body = screen(
		ExplorerPlatforms,
		'commit',
		{ category: 'platforms', entity: 'web' },
		{
			head: {
				...head,
				registry: { ...head.registry, available: false },
				platforms: platformFixture
			}
		}
	);
	expect(words(body)).toContain('orders-web');
	expect(words(body)).not.toContain('No registry at this revision');
});

test('a missing declaration never borrows parent or current project settings', () => {
	const body = screen(
		ExplorerPlatforms,
		'commit',
		{ category: 'platforms', entity: 'web' },
		{
			head: revision(commits.middle, []),
			parent: { ...revision(commits.first, []), platforms: platformFixture }
		}
	);
	expect(words(body)).toContain('No platform configuration is recorded at this revision.');
	expect(words(body)).not.toContain('orders-web');
	expect(words(body)).not.toContain('bun run build:web');
});
