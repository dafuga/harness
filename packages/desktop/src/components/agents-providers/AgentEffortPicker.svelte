<!-- @harness-tier organism -->
<!-- @harness-atoms ../../../../reports/src/components/shared-primitives/atoms -->
<script lang="ts">
	import ChoiceDialog from '../shared-primitives/ChoiceDialog.svelte';
	import Icon from '../shared-primitives/Icon.svelte';
	/**
	 * One icon opens the reasoning efforts the chosen model supports. A model that lists none runs
	 * at its own default, so the icon is then disabled rather than offering an effort it lacks.
	 */
	let { efforts, effort = $bindable() }: { efforts: string[]; effort: string } = $props();
	const tip = $derived(
		efforts.length ? `Reasoning effort: ${effort}` : 'Reasoning effort: model default'
	);
	function choose(next: string, close: () => void) {
		effort = next;
		close();
	}
</script>

<ChoiceDialog
	label="Reasoning effort"
	title={tip}
	disabled={!efforts.length}
	width={220}
	maxHeight={420}
	gap={6}
>
	{#snippet icon()}<Icon name="reasoning" size={18} />{/snippet}
	{#snippet children(close: () => void)}
		{#each efforts as item (item)}<hx-button
				type="button"
				class:active={item === effort}
				aria-pressed={item === effort}
				onclick={() => choose(item, close)}>{item}</hx-button
			>{/each}
	{/snippet}
</ChoiceDialog>
