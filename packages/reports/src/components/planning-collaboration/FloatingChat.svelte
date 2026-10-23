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

{#snippet chat()}<svg
		viewBox="0 0 24 24"
		width="24"
		height="24"
		aria-hidden="true"
		focusable="false"
		><path
			d="M5 4.5h14a2 2 0 0 1 2 2v8.5a2 2 0 0 1-2 2h-6.5L8 20.5V17H5a2 2 0 0 1-2-2V6.5a2 2 0 0 1 2-2zM7.5 9h9M7.5 12.5h6"
		/></svg
	>{/snippet}

<svelte:window onkeydown={escape} />
<div class="floating-chat" bind:this={root}>
	{#if open || kept}<aside
			id="{id}-panel"
			class="floating-chat-panel"
			aria-label={panelLabel}
			aria-describedby={notice ? `${id}-notice` : undefined}
			hidden={!open}
			tabindex="-1"
			bind:this={panel}
		>
			<header>
				<div>
					<h2>{title}</h2>
					{#if notice}<p id="{id}-notice">{notice}</p>{/if}
				</div>
				<button
					type="button"
					class="floating-chat-close"
					aria-label="Close chat"
					onclick={() => show(false)}><HarnessIcon name="close" size={16} /></button
				>
			</header>
			<div class="floating-chat-body" bind:this={body} onscroll={track}>{@render children()}</div>
		</aside>{/if}
	<button
		bind:this={bubble}
		type="button"
		class="floating-chat-bubble"
		aria-label={label}
		aria-expanded={open}
		aria-controls="{id}-panel"
		onclick={() => show(!open)}
		>{#if open}<HarnessIcon name="chevron-down" size={22} />{:else}{@render chat()}{/if}</button
	>
</div>

<style>
	/* No box of its own, so a host's rules for its children never move the bubble or the panel. */
	.floating-chat {
		/* On a phone the margin narrows to the panel's own, so the panel sits evenly. */
		--fc-right: calc(var(--floating-chat-right, min(20px, 3vw)) + env(safe-area-inset-right, 0px));
		--fc-bottom: calc(var(--floating-chat-bottom, 20px) + env(safe-area-inset-bottom, 0px));
		--fc-above: calc(var(--fc-bottom) + 66px);
		display: contents;
	}
	/* Under a sheet or a dialog that is open, above the page and its sticky bar. */
	.floating-chat-bubble,
	.floating-chat-panel {
		position: fixed;
		right: var(--fc-right);
		z-index: 35;
		box-sizing: border-box;
		border: 1px solid var(--line, #24485c);
		box-shadow: 0 14px 40px rgb(0 0 0 / 0.45);
	}
	.floating-chat-bubble,
	.floating-chat-close {
		display: grid;
		flex: none;
		place-items: center;
		padding: 0;
		border-radius: 50%;
		cursor: pointer;
	}
	.floating-chat-bubble {
		bottom: var(--fc-bottom);
		width: 54px;
		height: 54px;
		background: var(--ink, #04141e);
		color: var(--gold, #f3c33b);
	}
	.floating-chat-bubble svg {
		fill: none;
		stroke: currentColor;
		stroke-width: 1.6;
		stroke-linecap: round;
	}
	.floating-chat-bubble:hover,
	.floating-chat-bubble[aria-expanded='true'],
	.floating-chat-close:hover {
		border-color: var(--gold, #f3c33b);
		color: var(--gold, #f3c33b);
	}
	.floating-chat-bubble:focus-visible,
	.floating-chat-close:focus-visible {
		outline: 2px solid var(--gold, #f3c33b);
		outline-offset: 3px;
	}
	/* Above the bubble, and below the bar at the top of the page however far that bar wraps. */
	.floating-chat-panel {
		bottom: var(--fc-above);
		display: flex;
		flex-direction: column;
		width: min(400px, calc(100vw - 24px));
		max-height: min(620px, calc(100dvh - var(--fc-above) - var(--floating-chat-top, 168px)));
		overflow: hidden;
		border-radius: 16px;
		background: var(--panel, #082131);
		color: var(--hx-text, #edf4fa);
	}
	.floating-chat-panel[hidden] {
		display: none;
	}
	.floating-chat-panel:focus {
		outline: none;
	}
	header {
		display: flex;
		flex: none;
		gap: 12px;
		align-items: flex-start;
		justify-content: space-between;
		padding: 12px 10px 10px 16px;
		border-bottom: 1px solid var(--line, #24485c);
	}
	h2 {
		margin: 0;
		font-size: 15px;
		font-weight: 600;
	}
	header p {
		margin: 3px 0 0;
		color: var(--muted, #8fa1b8);
		font-size: 12.5px;
		line-height: 1.4;
	}
	.floating-chat-close {
		width: 32px;
		height: 32px;
		border: 0;
		background: none;
		color: var(--muted, #8fa1b8);
	}
	.floating-chat-body {
		display: flex;
		flex: 1;
		flex-direction: column;
		gap: 10px;
		min-height: 0;
		padding: 12px 14px 0;
		overflow-y: auto;
		overscroll-behavior: contain;
	}
	/* A short screen gives the conversation the height the bar would keep. */
	@media (max-height: 560px) {
		.floating-chat-panel {
			max-height: calc(100dvh - var(--fc-above) - 12px - env(safe-area-inset-top, 0px));
		}
	}
</style>
