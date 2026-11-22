<!-- @harness-tier organism -->
<!-- @harness-atoms ../../../../reports/src/components/shared-primitives/atoms -->
<!-- @harness-uid u_s3llohludu -->
<script lang="ts">
	const steps = [
		{
			title: 'Describe the change',
			body: 'Write the goal as a short spec. Harness generators lay out the files the way your project expects, so nothing starts from a blank page.'
		},
		{
			title: 'Run the loop',
			body: 'Your agent works in small steps: it records a failing test first, then repairs the code until that same, unchanged test passes.'
		},
		{
			title: 'Ship the proof',
			body: 'Each change lands with its tests, audit and screenshots attached. Reviewers see what was proven, not just what was claimed.'
		}
	];
</script>

<hx-section class="home-section" id="how" aria-labelledby="home-how">
	<hx-p class="home-kicker">How it works</hx-p>
	<hx-h2 id="home-how" class="home-heading">From an idea to a proven change in three steps</hx-h2>
	<hx-ol class="home-steps">
		{#each steps as step, index (step.title)}
			<hx-li class="home-step">
				<hx-span class="home-step-number" aria-hidden="true">{index + 1}</hx-span>
				<hx-h3>{step.title}</hx-h3>
				<hx-p>{step.body}</hx-p>
			</hx-li>
		{/each}
	</hx-ol>
</hx-section>
