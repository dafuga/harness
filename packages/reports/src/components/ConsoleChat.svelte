<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import ProjectAgent from '../../../desktop/src/components/ProjectAgent.svelte';
	import { createConsoleWorkspaceStore } from '../lib/stores/consoleWorkspace.svelte';
	let {
		base,
		path,
		navigate
	}: { base: string; path: string; navigate: (path: string, replace: boolean) => void } = $props();
	const host = untrack(() => createConsoleWorkspaceStore(navigate));
	let mounted = $state(false);
	let open = $state(false);
	onMount(() => {
		mounted = true;
		return host.close;
	});
	$effect(() => {
		if (mounted && open) void host.workspace.navigate(base + path.split('?')[0], false);
	});
</script>

<svelte:window onpagehide={() => host.close()} />
<div class="console-chat"><ProjectAgent bind:open workspace={host.workspace} /></div>

<style>
	.console-chat {
		--panel: var(--hx-surface, #101f2d);
		--ink: var(--hx-bg, #0d1a26);
		--gold: var(--hx-gold, #f3c33b);
		--line: var(--hx-line, #2c4259);
		--text: var(--hx-text, #f2f5fa);
		--muted: var(--hx-muted, #8fa1b8);
		display: contents;
		color: var(--text);
		font-size: 14px;
		line-height: 1.45;
		overflow-wrap: anywhere;
	}

	.console-chat :global(*),
	.console-chat :global(*::before),
	.console-chat :global(*::after) {
		box-sizing: border-box;
	}
	.console-chat > :global(*) {
		flex: 1 1 auto;
		min-width: 0;
		min-height: 0;
		max-width: 100%;
	}
	.console-chat :global(form),
	.console-chat :global(.composer) {
		gap: 0.5rem;
		width: 100%;
		max-width: 100%;
		min-width: 0;
		padding: 0.625rem;
		border-top: 1px solid var(--line);
		background: var(--panel);
	}
	.console-chat :global(textarea),
	.console-chat :global(input:not([type='checkbox']):not([type='radio'])),
	.console-chat :global(select) {
		width: 100%;
		max-width: 100%;
		min-width: 0;
		margin: 0;
		padding: 0.5rem 0.625rem;
		border: 1px solid var(--line);
		border-radius: 8px;
		background: var(--panel);
		color: var(--text);
		font: inherit;
	}
	.console-chat :global(textarea) {
		min-height: 3.25rem;
		max-height: 10rem;
		resize: vertical;
	}
	.console-chat :global(textarea::placeholder),
	.console-chat :global(input::placeholder) {
		color: var(--muted);
	}
	.console-chat :global(textarea:focus-visible),
	.console-chat :global(input:focus-visible),
	.console-chat :global(select:focus-visible),
	.console-chat :global(button:focus-visible) {
		outline: 2px solid var(--gold);
		outline-offset: 1px;
	}
	.console-chat :global(button:not(.floating-chat-bubble):not(.floating-chat-close)) {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.375rem;
		max-width: 100%;
		min-height: 2rem;
		margin: 0;
		padding: 0.375rem 0.75rem;
		border: 1px solid var(--line);
		border-radius: 8px;
		background: var(--panel);
		color: var(--text);
		font: inherit;
		font-size: 13px;
		line-height: 1.2;
		cursor: pointer;
	}
	.console-chat :global(button:hover:not(:disabled)) {
		border-color: var(--gold);
	}
	.console-chat :global(button:disabled) {
		opacity: 0.5;
		cursor: not-allowed;
	}
	.console-chat :global(.modes),
	.console-chat :global(.models),
	.console-chat :global([role='radiogroup']),
	.console-chat :global([role='group']) {
		display: flex;
		flex-wrap: wrap;
		gap: 0.375rem;
		min-width: 0;
	}
	.console-chat :global(.mode),
	.console-chat :global(.model) {
		flex: 0 1 auto;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.console-chat :global(button.active),
	.console-chat :global(button[aria-pressed='true']),
	.console-chat :global(button[aria-checked='true']),
	.console-chat :global(button[aria-selected='true']) {
		border-color: var(--gold);
		background: color-mix(in srgb, var(--gold) 14%, var(--panel));
		color: var(--gold);
	}
	.console-chat :global(button[type='submit']),
	.console-chat :global(button.primary),
	.console-chat :global(button.send) {
		border-color: var(--gold);
		background: var(--gold);
		color: var(--ink);
		font-weight: 600;
	}
	.console-chat :global(button[type='submit']:hover:not(:disabled)),
	.console-chat :global(button.primary:hover:not(:disabled)),
	.console-chat :global(button.send:hover:not(:disabled)) {
		filter: brightness(0.95);
	}
	.console-chat :global(.error),
	.console-chat :global([role='alert']) {
		padding: 0.5rem 0.625rem;
		border: 1px solid var(--hx-fail, #f2545b);
		border-radius: 8px;
		background: var(--hx-danger-soft, #351c25);
		color: var(--hx-fail, #f2545b);
		font-size: 13px;
	}
	.console-chat :global(small),
	.console-chat :global(.hint),
	.console-chat :global(.meta),
	.console-chat :global(.muted) {
		color: var(--muted);
		font-size: 12px;
		line-height: 1.35;
	}
	.console-chat :global(pre),
	.console-chat :global(code) {
		max-width: 100%;
		overflow-x: auto;
		white-space: pre-wrap;
	}
	@media (max-width: 420px) {
		.console-chat :global(form),
		.console-chat :global(.composer) {
			padding: 0.5rem;
		}
		.console-chat :global(textarea) {
			font-size: 16px;
		}
		.console-chat :global(button:not(.floating-chat-bubble):not(.floating-chat-close)) {
			padding: 0.375rem 0.5rem;
		}
	}
</style>
