import { render } from 'svelte/server';
import { expect, test } from 'vitest';
import HomeDownload from '../../../src/components/public-site/HomeDownload.svelte';
import HomeHero from '../../../src/components/public-site/HomeHero.svelte';
import { homeDownloadConfig } from '../../../src/configs/public-site/homeDownloadConfig';

const html = (mac: string | null, ios: string | null) =>
	render(HomeDownload, { props: { mac, ios } }).body;

test('an unpublished Mac build is a disabled button that says why, never a dead link', () => {
	const body = html(null, null);
	expect(body).toMatch(/<button[^>]*disabled[^>]*aria-describedby="home-mac-pending"/);
	expect(body).toMatch(/<button[^>]*>Mac app coming soon<\/button>/);
	expect(body).toContain('id="home-mac-pending"');
	expect(body).not.toMatch(/<a[^>]*download/);
	expect(body).toContain('iPhone app · Coming soon');
});

test('a published build is a direct download link and the iPhone app gets its own link', () => {
	const body = html('/downloads/Harness.dmg', 'https://apps.apple.com/app/harness');
	expect(body).toMatch(/<a[^>]*href="\/downloads\/Harness\.dmg"[^>]*download/);
	expect(body).not.toContain('<button');
	expect(body).toMatch(
		/<a[^>]*href="https:\/\/apps\.apple\.com\/app\/harness"[^>]*>Get the iPhone app/
	);
});

test('the hero download goes to the build when there is one, else is a muted chip', () => {
	const pending = render(HomeHero, { props: { download: '#download' } }).body;
	expect(pending).toMatch(/<span class="home-badge"[^>]*>Mac app coming soon<\/span>/);
	expect(pending).not.toContain('href="#download"');
	expect(pending).toContain('iPhone app coming soon');
	const ready = render(HomeHero, { props: { download: '/downloads/Harness.dmg', iosReady: true } });
	expect(ready.body).toMatch(/<a[^>]*href="\/downloads\/Harness\.dmg"/);
	expect(ready.body).toContain('Download for Mac');
	expect(ready.body).not.toContain('coming soon');
});

test('the hero has one filled primary: Log in while the Mac build is pending, the download once published', () => {
	const pending = render(HomeHero, { props: { download: '#download' } }).body;
	expect(pending.match(/home-button-primary/g)).toHaveLength(1);
	expect(pending).toMatch(
		/<a class="home-button home-button-primary home-button-large" href="\/projects"[^>]*>Log in<\/a>/
	);
	expect(pending).not.toMatch(/<(a|button)[^>]*>Mac app coming soon/);
	const ready = render(HomeHero, { props: { download: '/downloads/Harness.dmg', iosReady: true } });
	expect(ready.body.match(/home-button-primary/g)).toHaveLength(1);
	expect(ready.body).toMatch(
		/<a class="home-button home-button-primary home-button-large" href="\/downloads\/Harness\.dmg"[^>]*>Download for Mac<\/a>/
	);
});

test('the Mac archive is asked for at its Hub path and the iPhone app stays pending', () => {
	expect(homeDownloadConfig).toEqual({
		mac: { path: '/downloads/Harness-mac-arm64.zip', mediaType: 'application/zip' },
		ios: null
	});
});

test('the hero leads to sign-in and projects under the name that fits the visitor', () => {
	const visitor = render(HomeHero, { props: { download: '#download' } }).body;
	expect(visitor).toMatch(/<a[^>]*href="\/projects"[^>]*>Log in/);
	const member = render(HomeHero, {
		props: { download: '#download', projects: '/projects', entry: 'Your projects' }
	}).body;
	expect(member).toMatch(/<a[^>]*href="\/projects"[^>]*>Your projects/);
	expect(member).not.toContain('#sign-in');
});
