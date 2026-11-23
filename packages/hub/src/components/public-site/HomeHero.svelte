<!-- @harness-tier organism -->
<!-- @harness-atoms ../../../../reports/src/components/shared-primitives/atoms -->
<!-- @harness-uid u_fef6uljonw -->
<script lang="ts">
	import '../../lib/styles/home-hero.css';
	/**
	 * `download` is the Mac build, or the download section while that build is not published.
	 * `projects` is sign-in and the projects page; `entry` names it for who is looking.
	 */
	let {
		download,
		iosReady = false,
		projects = '/projects',
		entry = 'Log in'
	}: { download: string; iosReady?: boolean; projects?: string; entry?: string } = $props();
	/**
	 * Until the archive is published the hero has one filled primary, Log in, and the pending Mac
	 * build is a muted chip, not an action. Once it is published the download is the primary.
	 */
	const pending = $derived(download.startsWith('#'));
	const loop = [
		{ label: 'Spec: customers can check out', state: 'spec' },
		{ label: 'Failing test recorded first', state: 'red' },
		{ label: 'Repair passes the same test', state: 'green' },
		{ label: 'Audit, tests and screenshots', state: 'proof' }
	];
</script>

<hx-section class="home-hero" aria-labelledby="home-title">
	<hx-div class="home-hero-copy">
		<hx-p class="home-kicker">For people who build software with coding agents</hx-p>
		<hx-h1 id="home-title" class="home-title"
			>Build with agents. <hx-span class="home-accent">Ship what you can prove.</hx-span></hx-h1
		>
		<hx-p class="home-lede">
			Harness gives every project a clear shape (small focused files, generators and specs) and runs
			each change as a loop: a failing test first, then the repair, then the proof. Your team sees
			exactly what was checked before anything merges.
		</hx-p>
		<hx-div class="home-actions">
			{#if pending}
				<hx-a
					class="home-button home-button-primary home-button-large"
					href={projects}
					data-sveltekit-reload>{entry}</hx-a
				>
				<hx-span class="home-badge">Mac app coming soon</hx-span>
			{:else}
				<hx-a class="home-button home-button-primary home-button-large" href={download}
					>Download for Mac</hx-a
				>
				<hx-a class="home-button home-button-large" href={projects} data-sveltekit-reload
					>{entry}</hx-a
				>
			{/if}
		</hx-div>
		<hx-p class="home-fine">
			Mac app · Shared projects in any browser · {iosReady
				? 'iPhone app'
				: 'iPhone app coming soon'}
		</hx-p>
	</hx-div>
	<hx-figure class="home-loop">
		<hx-div class="home-loop-bar" aria-hidden="true">
			<hx-span class="home-loop-dot"></hx-span><hx-span class="home-loop-dot"></hx-span><hx-span
				class="home-loop-dot"
			></hx-span>
			<hx-code>harness loop · checkout-flow</hx-code>
		</hx-div>
		<hx-ol class="home-loop-steps">
			{#each loop as step (step.state)}
				<hx-li class="home-loop-step" data-state={step.state}>
					<hx-span class="home-loop-mark" aria-hidden="true"></hx-span>
					<hx-span class="home-loop-label">{step.label}</hx-span>
					<hx-code class="home-loop-tag">{step.state}</hx-code>
				</hx-li>
			{/each}
		</hx-ol>
		<hx-figcaption class="home-loop-caption">Every change carries its own evidence.</hx-figcaption>
	</hx-figure>
</hx-section>
