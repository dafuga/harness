<!-- @harness-tier organism -->
<!-- @harness-atoms ../../../../reports/src/components/shared-primitives/atoms -->
<!-- @harness-uid u_nr32gdppvc -->
<script lang="ts">
	const features = [
		{
			title: 'One structure agents can follow',
			body: 'Generators, specs and audit limits keep files small and predictable, so an agent reads the project the way you do.'
		},
		{
			title: 'Proof, not promises',
			body: 'Loops keep the failing run, the repair and the passing run, with fresh screenshots for every UI change.'
		},
		{
			title: 'Shared with your team',
			body: 'Invite readers, commenters and writers. Everyone browses the same pages, components and history.'
		},
		{
			title: 'On your Mac and in the browser',
			body: 'The Mac app runs your local projects with your agents. Shared projects open in any browser, with iPhone next.'
		}
	];
</script>

<hx-section class="home-section" aria-labelledby="home-features">
	<hx-p class="home-kicker">Why Harness</hx-p>
	<hx-h2 id="home-features" class="home-heading">Built for people and agents working together</hx-h2
	>
	<hx-ul class="home-features">
		{#each features as feature (feature.title)}
			<hx-li class="home-feature">
				<hx-h3>{feature.title}</hx-h3>
				<hx-p>{feature.body}</hx-p>
			</hx-li>
		{/each}
	</hx-ul>
</hx-section>
