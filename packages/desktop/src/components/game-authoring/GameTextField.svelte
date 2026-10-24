<script lang="ts">
	/**
	 * A text field that reports every keystroke, so unsaved work is known at once, yet keeps what was
	 * typed while it has focus: a partial reading such as `-2.` or `door,` is not rewritten under the
	 * cursor. Leaving the field shows the value the game holds.
	 */
	let {
		value,
		change,
		label,
		placeholder = '',
		readonly = false
	}: {
		value: string;
		change: (text: string) => void;
		label?: string;
		placeholder?: string;
		readonly?: boolean;
	} = $props();
	let typed = $state<string | null>(null);
</script>

<input
	aria-label={label}
	{placeholder}
	{readonly}
	value={typed ?? value}
	oninput={(event) => {
		typed = event.currentTarget.value;
		change(typed);
	}}
	onblur={() => (typed = null)}
/>

<style>
	input:focus-visible {
		outline: var(--hx-border-thick) solid var(--hx-color-primary);
	}
</style>
