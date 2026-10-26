<!-- @harness-tier molecule -->
<!-- @harness-atoms ../../../../reports/src/components/shared-primitives/atoms -->
<script lang="ts">
	let { label = 'ProjectWorkFeature', error }: { label?: string; error?: string } = $props();
</script>

<hx-section
	data-harness-component="project-work-feature"
	aria-label={label}
	aria-describedby={error ? 'project-work-feature-error' : undefined}
>
	<hx-h2>{label}</hx-h2>
	{#if error}
		<hx-p id="project-work-feature-error" role="alert">{error}</hx-p>
	{/if}
</hx-section>
