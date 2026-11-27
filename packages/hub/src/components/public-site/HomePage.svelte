<!-- @harness-tier organism -->
<!-- @harness-atoms ../../../../reports/src/components/shared-primitives/atoms -->
<!-- @harness-uid u_uvdzwua6yi -->
<script lang="ts">
	import BrandMark from '$shared/BrandMark.svelte';
	import { resolve } from '$app/paths';
	import { onMount } from 'svelte';
	import '../../../../reports/src/lib/styles/home-scheme.css';
	import '../../lib/styles/home.css';
	import { homeDownloadConfig } from '../../configs/public-site/homeDownloadConfig';
	import { browserContext } from '../../utils/development-tooling/browserContext';
	import { publishedDownload } from '../../utils/public-site/publishedDownload';
	import HomeDownload from './HomeDownload.svelte';
	import HomeFeatures from './HomeFeatures.svelte';
	import HomeHero from './HomeHero.svelte';
	import HomeSteps from './HomeSteps.svelte';
	/** The public front door for everyone: what Harness is, the app, and the way to your projects. */
	const { session } = browserContext();
	const { mac: release, ios } = homeDownloadConfig;
	const home = resolve('/about');
	/** Sign-in and the signed-in person's projects are one page; the homepage only links to it. */
	const projects = $derived(session.actor ? '/projects' : '/');
	const entry = $derived(session.actor ? 'Your projects' : 'Log in');
	/** Null until the Hub confirms it serves the archive; publishing switches it on, no rebuild. */
	let mac = $state<string | null>(null);
	onMount(() => {
		let current = true;
		void publishedDownload(release.path, release.mediaType).then((found) => {
			if (current) mac = found;
		});
		return () => {
			current = false;
		};
	});
</script>

<!-- The outer element keeps the shared dark values; the page below may follow a light scheme. -->
<hx-div class="home-scheme">
	<hx-div class="home-page">
		<hx-header class="home-bar">
			<hx-a class="brand home-brand" href={home}
				><hx-span class="brand-mark"><BrandMark /></hx-span> Harness</hx-a
			>
			<hx-nav class="home-nav" aria-label="Homepage">
				<hx-a class="home-nav-link" href="#how">How it works</hx-a>
				<hx-a class="home-nav-link" href="#download">Download</hx-a>
				<hx-a class="home-button home-button-small" href={projects} data-sveltekit-reload
					>{entry}</hx-a
				>
			</hx-nav>
		</hx-header>
		<hx-main class="home-main">
			<HomeHero download={mac ?? '#download'} iosReady={ios !== null} {projects} {entry} />
			<HomeSteps />
			<HomeFeatures />
			<HomeDownload {mac} {ios} />
		</hx-main>
		<hx-footer class="home-footer">
			<hx-p
				><hx-strong>Harness</hx-strong> · Structure, loops and proof for software built with coding agents.</hx-p
			>
			<hx-nav class="home-nav" aria-label="Footer">
				<hx-a class="home-nav-link" href="#how">How it works</hx-a>
				<hx-a class="home-nav-link" href="#download">Download</hx-a>
				<hx-a class="home-nav-link" href={projects} data-sveltekit-reload>{entry}</hx-a>
			</hx-nav>
		</hx-footer>
	</hx-div>
</hx-div>
