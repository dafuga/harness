<!-- @harness-tier molecule -->
<!-- @harness-atoms ../../../../reports/src/components/shared-primitives/atoms -->
<script lang="ts">
	import { tick, type Snippet } from 'svelte';
	/**
	 * One icon that opens a modal list of choices. Opening focuses the chosen enabled choice;
	 * Escape closes this dialog only, never a panel around it; a click on the backdrop closes it;
	 * closing returns focus to the icon. A choice closes it through the `close` it is given;
	 * `onopen` is told each time the dialog is shown. It keeps at least 12 pixels clear of each edge
	 * of the viewport, anchors beside its trigger, and scrolls choices that do not fit.
	 * Inside a panel, placement keeps its header clear.
	 */
	let {
		label,
		title,
		disabled = false,
		width,
		maxHeight,
		gap = 6,
		activeCount,
		icon,
		onopen,
		children,
		footer
	}: {
		label: string;
		title: string;
		disabled?: boolean;
		/** How many things the icon stands for are under way, kept on it as `data-active`. */
		activeCount?: number;
		/** The widest and tallest the dialog may be, in pixels, within the viewport. */
		width: number;
		maxHeight: number;
		/** The space between the choices, or the groups of choices, in pixels. */
		gap?: number;
		icon: Snippet;
		/** Called once the dialog is shown; work it starts is not waited for. */
		onopen?: () => void;
		children: Snippet<[close: () => void]>;
		/** An action row kept in sight at the dialog's end while what is above it scrolls. */
		footer?: Snippet<[close: () => void]>;
	} = $props();
	let trigger = $state<HTMLButtonElement>();
	let dialog = $state<HTMLDialogElement>();
	let shown = $state(false);
	function place() {
		if (!trigger || !dialog?.open) return;
		const gutter = Number.parseFloat(getComputedStyle(dialog).getPropertyValue('--hx-space-12'));
		const anchor = trigger.getBoundingClientRect();
		const header = trigger.closest('aside')?.querySelector('header')?.getBoundingClientRect();
		const ceiling = Math.max(gutter, header?.bottom ?? gutter);
		const above = Math.max(0, anchor.top - ceiling);
		const below = Math.max(0, innerHeight - gutter - anchor.bottom);
		const upwards = above >= below;
		dialog.style.maxHeight = `${Math.min(maxHeight, upwards ? above : below)}px`;
		const bounds = dialog.getBoundingClientRect();
		dialog.style.left = `${Math.max(gutter, Math.min(anchor.left, innerWidth - bounds.width - gutter))}px`;
		dialog.style.top = `${upwards ? Math.max(ceiling, anchor.top - bounds.height) : anchor.bottom}px`;
	}
	$effect(() => {
		if (!shown || !dialog || !trigger) return;
		place();
		const observer = new ResizeObserver(place);
		observer.observe(dialog);
		observer.observe(trigger);
		window.addEventListener('scroll', place, true);
		return () => {
			observer.disconnect();
			window.removeEventListener('scroll', place, true);
		};
	});
	async function open() {
		dialog?.showModal();
		shown = true;
		place();
		onopen?.();
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

<svelte:window onresize={place} />
<hx-button
	bind:this={trigger}
	type="button"
	class="agent-icon"
	aria-label={label}
	aria-haspopup="dialog"
	data-active={activeCount}
	{title}
	{disabled}
	onclick={open}>{@render icon()}</hx-button
>
<hx-dialog
	bind:this={dialog}
	class="agent-picker"
	class:with-footer={!!footer}
	aria-label={label}
	style:--picker-width="{width}px"
	style:--picker-height="{maxHeight}px"
	style:--picker-gap="{gap}px"
	onclick={(event) => event.target === event.currentTarget && close()}
	onkeydown={keydown}
	onclose={() => {
		shown = false;
		trigger?.focus();
	}}
>
	<hx-div class="agent-picker-body">{@render children(close)}</hx-div>
	{#if footer}<hx-div class="agent-picker-footer">{@render footer(close)}</hx-div>{/if}
</hx-dialog>

<style>
	.agent-picker {
		position: fixed;
		inset: auto;
		margin: 0;
		width: min(var(--picker-width), calc(100vw - 24px));
		max-height: min(var(--picker-height), calc(100dvh - 24px));
		padding: 0;
		border: var(--hx-border-thin) solid var(--hx-color-border);
		border-radius: var(--hx-radius);
		background: var(--hx-color-surface);
		color: inherit;
		overflow: auto;
		overscroll-behavior: contain;
	}
	/* The dialog stays the one thing that scrolls; its footer sticks to the end it scrolls under,
	   and a part scrolled into view is kept clear of it. */
	.with-footer {
		scroll-padding-block-end: 80px;
	}
	.agent-picker-footer {
		position: sticky;
		bottom: 0;
		padding: var(--hx-space-12) var(--hx-space-14) var(--hx-space-14);
		border-top: var(--hx-border-thin) solid var(--hx-color-border);
		background: var(--hx-color-surface);
	}
	.agent-picker::backdrop {
		background: var(--hx-color-scrim);
	}
	.agent-picker-body {
		display: grid;
		gap: var(--picker-gap);
		padding: var(--hx-space-14);
	}
	.agent-picker-body :global(button) {
		justify-content: start;
		text-align: start;
	}
</style>
