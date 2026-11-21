<!-- @harness-tier organism -->
<!-- @harness-atoms ../../../../reports/src/components/shared-primitives/atoms -->
<!-- @harness-uid u_uvdzwua6yi -->
<script lang="ts">
	import BrandMark from '$shared/BrandMark.svelte';
	import { resolve } from '$app/paths';
	import '../../lib/styles/home-scheme.css';
	import '../../lib/styles/home.css';
	import { homeDownloadConfig } from '../../configs/public-site/homeDownloadConfig';
	import LoginPanel from '../accounts-access/login-panel/LoginPanel.svelte';
	import HomeDownload from './HomeDownload.svelte';
	import HomeFeatures from './HomeFeatures.svelte';
	import HomeHero from './HomeHero.svelte';
	import HomeSteps from './HomeSteps.svelte';
	/** The public front door: what Harness is, how to get the app, and the way in to your projects. */
	const { mac, ios } = homeDownloadConfig;
	const home = resolve('/');
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
				<hx-a class="home-button home-button-small" href="#sign-in">Log in</hx-a>
			</hx-nav>
		</hx-header>
		<hx-main class="home-main">
			<HomeHero download={mac ?? '#download'} iosReady={ios !== null} />
			<HomeSteps />
			<HomeFeatures />
			<HomeDownload {mac} {ios} />
			<hx-section class="home-section home-sign-in" id="sign-in" aria-label="Log in">
				<LoginPanel
					reason="Sign in with Google to open the projects you own and the ones you were invited to."
				/>
			</hx-section>
		</hx-main>
		<hx-footer class="home-footer">
			<hx-p
				><hx-strong>Harness</hx-strong> · Structure, loops and proof for software built with coding agents.</hx-p
			>
			<hx-nav class="home-nav" aria-label="Footer">
				<hx-a class="home-nav-link" href="#how">How it works</hx-a>
				<hx-a class="home-nav-link" href="#download">Download</hx-a>
				<hx-a class="home-nav-link" href="#sign-in">Log in</hx-a>
			</hx-nav>
		</hx-footer>
	</hx-div>
</hx-div>
