<!-- @harness-tier organism -->
<!-- @harness-atoms ../shared-primitives/atoms -->
<script lang="ts">
	import { tick, type Snippet } from 'svelte';
	import HarnessIcon from '../explorer-ui/HarnessIcon.svelte';
	/** Persistent round launcher; Escape closes its panel and returns focus. */
	let {
		open = $bindable(false),
		label,
		panelLabel,
		title,
		notice = '',
		children
	}: {
		open?: boolean;
		label: string;
		panelLabel: string;
		title: string;
		/** What this conversation offers here, said under the title. */
		notice?: string;
		children: Snippet;
	} = $props();
	const id = $props.id();
	let root = $state<HTMLElement>();
	let bubble = $state<HTMLButtonElement>();
	let panel = $state<HTMLElement>();
	let body = $state<HTMLElement>();
	/** Once opened, the panel is only hidden, so a message being written is kept. */
	let kept = $state(false);
	let following = true;
	function reveal() {
		if (body) body.scrollTop = body.scrollHeight;
		following = true;
	}
	function track() {
		if (body) following = body.scrollHeight - body.scrollTop - body.clientHeight < 32;
	}
	$effect(() => {
		if (!body) return;
		const watcher = new MutationObserver(() => void (following && reveal()));
		watcher.observe(body, { childList: true, subtree: true, characterData: true });
		return () => watcher.disconnect();
	});
	async function show(next: boolean) {
		[open, kept] = [next, kept || next];
		await tick();
		if (!next) return bubble?.focus();
		reveal();
		(panel?.querySelector<HTMLElement>('textarea:enabled') ?? panel)?.focus();
	}
	/** A control inside that answers its own Escape, such as a picker, keeps the panel open. */
	function escape(event: KeyboardEvent) {
		if (!open || event.key !== 'Escape' || event.defaultPrevented) return;
		if (!root?.contains(event.target as Node)) return;
		event.preventDefault();
		void show(false);
	}
</script>
{#snippet chat()}<hx-svg
		viewBox="0 0 24 24"
		width="24"
		height="24"
		aria-hidden="true"
		focusable="false"
		><hx-svg-path
			d="M5 4.5h14a2 2 0 0 1 2 2v8.5a2 2 0 0 1-2 2h-6.5L8 20.5V17H5a2 2 0 0 1-2-2V6.5a2 2 0 0 1 2-2zM7.5 9h9M7.5 12.5h6"
		/></hx-svg
	>{/snippet}
<svelte:window onkeydown={escape} />
<hx-div class="floating-chat" bind:this={root}>
	{#if open || kept}<hx-aside
			id="{id}-panel"
			class="floating-chat-panel"
			aria-label={panelLabel}
			aria-describedby={notice ? `${id}-notice` : undefined}
			hidden={!open}
			tabindex="-1"
			bind:this={panel}
		>
			<hx-header>
				<hx-div>
					<hx-h2>{title}</hx-h2>
					{#if notice}<hx-p id="{id}-notice">{notice}</hx-p>{/if}
				</hx-div>
				<hx-button
					type="button"
					class="floating-chat-close"
					aria-label="Close chat"
					onclick={() => show(false)}><HarnessIcon name="close" size={16} /></hx-button
				>
			</hx-header>
			<hx-div class="floating-chat-body" bind:this={body} onscroll={track}
				>{@render children()}</hx-div
			>
		</hx-aside>{/if}
	<hx-button
		bind:this={bubble}
		type="button"
		class="floating-chat-bubble"
		aria-label={label}
		aria-expanded={open}
		aria-controls="{id}-panel"
		onclick={() => show(!open)}
		>{#if open}<HarnessIcon name="chevron-down" size={22} />{:else}{@render chat()}{/if}</hx-button
	>
</hx-div>
<style>
	@import "./floating-chat/floatingChat.css";
</style>
