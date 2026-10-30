import { expect, test } from 'vitest';
import { render } from 'svelte/server';
import ExplorerPlatformDetails from '../../../src/components/explorer-ui/ExplorerPlatformDetails.svelte';
import ExplorerPlatforms from '../../../src/components/explorer-ui/ExplorerPlatforms.svelte';
import { index, revision } from '../../entityFixture';
import { hostProps, screen, words } from '../../entityRender';
import { nav } from '../../entityPlaces';
import { commits } from '../../entityUnits';
import { platformFixture } from '../../platformFixture';

const head = { ...revision(commits.middle, []), platforms: platformFixture };
test('detail configuration and source links belong to the selected project and commit', () => {
	const body = screen(
		ExplorerPlatforms,
		'commit',
		{ category: 'platforms', entity: 'web' },
		{ head },
		{
			...index,
			sourceRepository: 'https://github.com/example/orders'
		}
	);
	expect(words(body)).toContain('orders-web');
	expect(words(body)).toContain('bun run build:web');
	expect(body).toContain(`https://github.com/example/orders/blob/${commits.middle}/wrangler.jsonc`);
	expect(body).not.toContain('github.com/dafuga/harness');
});

test('an unconfigured target shows requirements without an empty commands section', () => {
	const body = screen(
		ExplorerPlatforms,
		'commit',
		{ category: 'platforms', entity: 'android' },
		{ head }
	);
	expect(words(body)).toContain('Not configured');
	expect(words(body)).toContain('Add an Android project and release signing configuration.');
	expect(words(body)).not.toContain('Commands');
	expect(body).not.toContain('<table');
});

test('an invalid manifest and unknown platform are explicit states', () => {
	const invalid = screen(
		ExplorerPlatforms,
		'commit',
		{ category: 'platforms', entity: 'ios' },
		{
			head: {
				...head,
				platforms: {
					entries: [],
					gap: 'Platform configuration could not be read at this revision.'
				}
			}
		}
	);
	expect(words(invalid)).toContain('could not be read at this revision');
	const unknown = screen(
		ExplorerPlatforms,
		'commit',
		{ category: 'platforms', entity: 'unknown' },
		{ head }
	);
	expect(words(unknown)).toMatch(/platform.*not found|unknown platform/i);
	expect(unknown).toContain('/platforms');
});

test('source references never link to an untrusted repository origin', () => {
	const body = screen(
		ExplorerPlatforms,
		'commit',
		{ category: 'platforms', entity: 'web' },
		{ head },
		{
			...index,
			sourceRepository: 'https://elsewhere.invalid/example/orders'
		}
	);
	expect(words(body)).toContain('wrangler.jsonc');
	expect(body).not.toContain('https://elsewhere.invalid');
});

test('platform details propagate navigation and malformed source path errors', () => {
	const history = { ...index, sourceRepository: 'https://github.com/example/orders' };
	const host = hostProps('commit', { category: 'platforms', entity: 'web' }, { head }, history);
	const error = new Error('navigation unavailable');
	const links = {
		...nav(host.route),
		href: () => {
			throw error;
		}
	};
	expect(() => render(ExplorerPlatformDetails, { props: { host, nav: links } }).body).toThrow(
		error
	);
	const entries = platformFixture.entries.map((entry) =>
		entry.id === 'web' ? { ...entry, sources: ['\ud800'] } : entry
	);
	const malformed = { ...host, head: { ...head, platforms: { entries } } };
	expect(
		() => render(ExplorerPlatformDetails, { props: { host: malformed, nav: nav(host.route) } }).body
	).toThrow(URIError);
	expect(() => render(ExplorerPlatforms, { props: malformed }).body).toThrow(URIError);
});
