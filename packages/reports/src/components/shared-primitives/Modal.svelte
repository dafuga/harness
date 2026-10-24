<script lang="ts">
	import { t } from '../../utils/reports-media/reportLocale';
	import HarnessIcon from '../explorer-ui/HarnessIcon.svelte';
	let {
		open = false,
		isOpen,
		title = '',
		variant = 'image',
		onClose,
		onclose,
		children,
		footer
	} = $props<{
		open?: boolean;
		isOpen?: boolean;
		title?: string;
		variant?: 'image' | 'text' | 'lightbox';
		onClose?: () => void;
		onclose?: () => void;
		children?: import('svelte').Snippet;
		footer?: import('svelte').Snippet;
	}>();
	let dialog = $state<HTMLDialogElement>();
	let shown = $derived(isOpen ?? open);
	$effect(() => {
		if (shown) dialog?.showModal();
		else dialog?.close();
	});
	function close() {
		onClose?.();
		onclose?.();
	}
</script>

{#if shown}
	<dialog
		bind:this={dialog}
		oncancel={close}
		onclick={(event) => {
			if (event.target === dialog) close();
		}}
		class="viewer-dialog"
		class:text={variant === 'text'}
		class:lightbox={variant === 'lightbox'}
		data-harness-component="modal"
		aria-labelledby="viewer-dialog-title"
	>
		<header class="viewer-header">
			<h2 id="viewer-dialog-title">{title}</h2>
			<button onclick={close} aria-label={$t('close')}
				><HarnessIcon name="close" size={24} /></button
			>
		</header>
		<div class="viewer-content">{@render children?.()}</div>
		{#if footer}<footer>{@render footer()}</footer>{/if}
	</dialog>
{/if}

<style>
	/* Lightbox: a borderless full-screen canvas, so captured cards are not nested in another card */
	.viewer-dialog.lightbox[open] {
		display: flex;
		flex-direction: column;
		inset: 0;
		width: 100%;
		max-width: none;
		height: 100%;
		max-height: none;
		margin: 0;
		border: 0;
		border-radius: 0;
		background: var(--hx-color-background);
		box-shadow: none;
		overflow: hidden;
	}
	.lightbox .viewer-header {
		flex: none;
		padding: var(--hx-space-10) var(--hx-space-16) var(--hx-space-10) var(--hx-space-22);
		border-bottom-color: var(--hx-color-border);
		background: var(--hx-color-surface);
	}
	.lightbox .viewer-header h2 {
		min-width: 0;
		overflow-wrap: anywhere;
	}
	.lightbox .viewer-content {
		flex: 1;
		min-height: 0;
		overflow: auto;
	}
</style>
