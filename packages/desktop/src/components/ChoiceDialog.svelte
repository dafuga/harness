<script lang="ts">
	import { tick, type Snippet } from 'svelte';
	/**
	 * One icon that opens a modal list of choices. Opening focuses the chosen enabled choice;
	 * Escape closes this dialog only, never a panel around it; a click on the backdrop closes it;
	 * closing returns focus to the icon. A choice closes it through the `close` it is given.
	 */
	let {
		label,
		title,
		disabled = false,
		width,
		maxHeight,
		gap = 6,
		icon,
		children
	}: {
		label: string;
		title: string;
		disabled?: boolean;
		/** The widest and tallest the dialog may be, in pixels, within the viewport. */
		width: number;
		maxHeight: number;
		/** The space between the choices, or the groups of choices, in pixels. */
		gap?: number;
		icon: Snippet;
		children: Snippet<[close: () => void]>;
	} = $props();
	let trigger = $state<HTMLButtonElement>();
	let dialog = $state<HTMLDialogElement>();
	async function open() {
		dialog?.showModal();
		await tick();
		dialog?.querySelector<HTMLButtonElement>('[aria-pressed="true"]:enabled')?.focus();
	}
	function close() {
		dialog?.close();
	}
	/** Escape closes the picker only, never the panel around it. */
	function keydown(event: KeyboardEvent) {
		if (event.key !== 'Escape') return;
		event.preventDefault();
		event.stopPropagation();
		close();
	}
</script>

<button
	bind:this={trigger}
	type="button"
	class="agent-icon"
	aria-label={label}
	aria-haspopup="dialog"
	{title}
	{disabled}
	onclick={open}>{@render icon()}</button
>
<dialog
	bind:this={dialog}
	class="agent-picker"
	aria-label={label}
	style:--picker-width="{width}px"
	style:--picker-height="{maxHeight}px"
	style:--picker-gap="{gap}px"
	onclick={(event) => event.target === event.currentTarget && close()}
	onkeydown={keydown}
	onclose={() => trigger?.focus()}
>
	<div class="agent-picker-body">{@render children(close)}</div>
</dialog>

<style>
	.agent-picker {
		width: min(var(--picker-width), calc(100vw - 24px));
		max-height: min(var(--picker-height), calc(100dvh - 24px));
		padding: 0;
		border: 1px solid var(--line);
		border-radius: 10px;
		background: var(--panel);
		color: inherit;
		overflow: auto;
	}
	.agent-picker::backdrop {
		background: rgb(3 26 40 / 0.6);
	}
	.agent-picker-body {
		display: grid;
		gap: var(--picker-gap);
		padding: 14px;
	}
	.agent-picker-body :global(button) {
		justify-content: start;
		text-align: start;
	}
</style>
