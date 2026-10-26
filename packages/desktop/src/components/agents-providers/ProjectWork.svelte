<!-- @harness-tier organism -->
<!-- @harness-atoms ../../../../reports/src/components/shared-primitives/atoms -->
<script lang="ts">
	let { label = 'ProjectWork', error }: { label?: string; error?: string } = $props();
</script>

<hx-section
	data-harness-component="project-work"
	aria-label={label}
	aria-describedby={error ? 'project-work-error' : undefined}
>
	<hx-h2>{label}</hx-h2>
	{#if error}
		<hx-p id="project-work-error" role="alert">{error}</hx-p>
	{/if}
</hx-section>
