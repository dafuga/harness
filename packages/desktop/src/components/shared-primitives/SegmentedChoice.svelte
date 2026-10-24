<!-- @harness-tier molecule -->
<!-- @harness-atoms ../../../../reports/src/components/shared-primitives/atoms -->
<script lang="ts">
	let {
		value = $bindable(''),
		options,
		label
	}: { value?: string; options: string[]; label: string } = $props();
</script>

<hx-div class="segmented-choice" role="group" aria-label={label}>
	{#each options as option (option)}<hx-button
			type="button"
			class:active={value === option}
			aria-pressed={value === option}
			onclick={() => (value = option)}>{option}</hx-button
		>{/each}
</hx-div>
