<!-- @harness-tier organism -->
<!-- @harness-atoms ../../../../reports/src/components/shared-primitives/atoms -->
<!-- @harness-uid u_wnseowejkr -->
<script lang="ts">
	/** A null build is not published yet: the page says so rather than linking nowhere. */
	let { mac, ios }: { mac: string | null; ios: string | null } = $props();
</script>

<hx-section class="home-section home-download" id="download" aria-labelledby="home-download">
	<hx-div class="home-download-copy">
		<hx-p class="home-kicker">Download</hx-p>
		<hx-h2 id="home-download" class="home-heading">Get Harness on your Mac</hx-h2>
		<hx-p>
			The desktop app opens your projects, runs loops with your coding agents and keeps shared
			projects in sync with this Hub.
		</hx-p>
	</hx-div>
	<hx-div class="home-download-actions">
		{#if mac}<hx-a
				class="home-button home-button-primary home-button-large"
				href={mac}
				download
				data-sveltekit-reload>Download for Mac</hx-a
			>{:else}<hx-button
				type="button"
				class="home-button home-button-primary home-button-large"
				disabled
				aria-describedby="home-mac-pending">Download for Mac</hx-button
			>
			<hx-p class="home-fine" id="home-mac-pending">
				The Mac build is being prepared and will be posted here.
			</hx-p>{/if}
		{#if ios}<hx-a class="home-badge" href={ios}>Get the iPhone app</hx-a>{:else}<hx-span
				class="home-badge">iPhone app · Coming soon</hx-span
			>{/if}
	</hx-div>
</hx-section>
