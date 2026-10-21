<script lang="ts">
	let {
		value = $bindable(''),
		options,
		label
	}: { value?: string; options: string[]; label: string } = $props();
</script>

<div class="segmented-choice" role="group" aria-label={label}>
	{#each options as option (option)}<button
			type="button"
			class:active={value === option}
			aria-pressed={value === option}
			onclick={() => (value = option)}>{option}</button
		>{/each}
</div>
