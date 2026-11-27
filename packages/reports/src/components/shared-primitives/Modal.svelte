<!-- @harness-tier organism -->
<!-- @harness-atoms atoms -->
<!-- @harness-uid u_f6xsfq2f7u -->
<script lang="ts">
	import { t } from '../../utils/reports-media/reportLocale';
	import HarnessIcon from '../explorer-ui/HarnessIcon.svelte';
	let {
		open = false,
		isOpen,
		title = '',
		summary,
		actions,
		variant = 'image',
		modal = true,
		onClose,
		onclose,
		children,
		footer
	} = $props<{
		open?: boolean;
		isOpen?: boolean;
		title?: string;
		summary?: string;
		actions?: import('svelte').Snippet;
		variant?: 'image' | 'text' | 'lightbox' | 'section';
		modal?: boolean;
		onClose?: () => void;
		onclose?: () => void;
		children?: import('svelte').Snippet;
		footer?: import('svelte').Snippet;
	}>();
	let dialog = $state<HTMLDialogElement>();
	let openedAsModal = true;
	const titleId = $props.id();
	let shown = $derived(isOpen ?? open);
	$effect(() => {
		if (!dialog) return;
		if (!shown) {
			dialog.close();
			return;
		}
		if (dialog.open && openedAsModal === modal) return;
		if (dialog.open) dialog.close();
		if (modal) dialog.showModal();
		else dialog.show();
		openedAsModal = modal;
	});
	let closing = false;
	async function close() {
		if (closing) return;
		const target = dialog;
		if (
			target?.closest('.hh-home, .inbox') &&
			!matchMedia('(prefers-reduced-motion: reduce)').matches
		) {
			closing = true;
			try {
				await target.animate([{ opacity: 1 }, { opacity: 0 }], {
					duration: 150,
					easing: 'ease-out'
				}).finished;
			} finally {
				closing = false;
			}
			if (!target.isConnected || target !== dialog || !shown) return;
		}
		onClose?.();
		onclose?.();
	}
</script>

{#if shown}
	<hx-dialog
		bind:this={dialog}
		oncancel={(event) => {
			event.preventDefault();
			void close();
		}}
		onkeydown={(event) => {
			if (modal || event.key !== 'Escape' || !(event.target instanceof Element)) return;
			if (event.target.closest('dialog') !== dialog) return;
			event.preventDefault();
			event.stopPropagation();
			close();
		}}
		onclick={(event) => {
			if (event.target === dialog) close();
		}}
		class="viewer-dialog"
		class:text={variant === 'text'}
		class:lightbox={variant === 'lightbox'}
		class:hh-dialog={variant === 'section'}
		data-harness-component="modal"
		aria-labelledby={titleId}
	>
		<hx-header class="viewer-header" class:hh-dialog-head={variant === 'section'}>
			{#if variant === 'section'}
				<hx-div class="hh-dialog-titles">
					<hx-h2 id={titleId} class="hh-dialog-title">{title}</hx-h2>
					{#if summary}<hx-p class="po-totals">{summary}</hx-p>{/if}
				</hx-div>
				{@render actions?.()}
			{:else}
				<hx-h2 id={titleId}>{title}</hx-h2>
			{/if}
			<hx-button
				class:hh-icon-button={variant === 'section'}
				type="button"
				onclick={close}
				aria-label={$t('close')}><HarnessIcon name="close" size={24} /></hx-button
			>
		</hx-header>
		<hx-div class="viewer-content" class:hh-dialog-body={variant === 'section'}
			>{@render children?.()}</hx-div
		>
		{#if footer}<hx-footer>{@render footer()}</hx-footer>{/if}
	</hx-dialog>
{/if}

<style>
	/* Text dialogs should fit their recorded content instead of inheriting the viewport canvas. */
	.viewer-dialog.text[open] {
		box-sizing: border-box;
		width: min(760px, calc(100vw - 32px));
		height: fit-content;
		max-height: calc(100dvh - 32px);
	}
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
