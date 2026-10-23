<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import ProjectAgent from '../../../../desktop/src/components/ProjectAgent.svelte';
	import { createConsoleWorkspaceStore } from '../../lib/projects-sessions/console-workspace/consoleWorkspace.svelte';
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
		--panel: var(--hx-surface);
		--ink: var(--hx-bg);
		--gold: var(--hx-gold);
		--line: var(--hx-line);
		--text: var(--hx-text);
		--muted: var(--hx-muted);
		display: contents;
		color: var(--text);
		font-size: var(--hx-type-size-sm);
		line-height: var(--hx-style-leading-normal);
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
		gap: var(--hx-space-8);
		width: 100%;
		max-width: 100%;
		min-width: 0;
		padding: var(--hx-space-10);
		border-top: var(--hx-border-thin) solid var(--line);
		background: var(--panel);
	}
	.console-chat :global(textarea),
	.console-chat :global(input:not([type='checkbox']):not([type='radio'])),
	.console-chat :global(select) {
		width: 100%;
		max-width: 100%;
		min-width: 0;
		margin: 0;
		padding: var(--hx-space-8) var(--hx-space-10);
		border: var(--hx-border-thin) solid var(--line);
		border-radius: var(--hx-radius-small);
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
		outline: var(--hx-border-thick) solid var(--gold);
		outline-offset: var(--hx-border-thin);
	}
	.console-chat :global(button:not(.floating-chat-bubble):not(.floating-chat-close)) {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: var(--hx-space-6);
		max-width: 100%;
		min-height: 2rem;
		margin: 0;
		padding: var(--hx-space-6) var(--hx-space-12);
		border: var(--hx-border-thin) solid var(--line);
		border-radius: var(--hx-radius-small);
		background: var(--panel);
		color: var(--text);
		font: inherit;
		font-size: var(--hx-type-size-compact);
		line-height: var(--hx-style-leading-tight);
		cursor: pointer;
	}
	.console-chat :global(button:hover:not(:disabled)) {
		border-color: var(--gold);
	}
	.console-chat :global(button:disabled) {
		opacity: var(--hx-opacity-dim);
		cursor: not-allowed;
	}
	.console-chat :global(.modes),
	.console-chat :global(.models),
	.console-chat :global([role='radiogroup']),
	.console-chat :global([role='group']) {
		display: flex;
		flex-wrap: wrap;
		gap: var(--hx-space-6);
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
		font-weight: var(--hx-style-weight-semibold);
	}
	.console-chat :global(button[type='submit']:hover:not(:disabled)),
	.console-chat :global(button.primary:hover:not(:disabled)),
	.console-chat :global(button.send:hover:not(:disabled)) {
		filter: brightness(0.95);
	}
	.console-chat :global(.error),
	.console-chat :global([role='alert']) {
		padding: var(--hx-space-8) var(--hx-space-10);
		border: var(--hx-border-thin) solid var(--hx-fail);
		border-radius: var(--hx-radius-small);
		background: var(--hx-danger-soft);
		color: var(--hx-fail);
		font-size: var(--hx-type-size-compact);
	}
	.console-chat :global(small),
	.console-chat :global(.hint),
	.console-chat :global(.meta),
	.console-chat :global(.muted) {
		color: var(--muted);
		font-size: var(--hx-type-size-xs);
		line-height: var(--hx-style-leading-snug);
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
			padding: var(--hx-space-8);
		}
		.console-chat :global(textarea) {
			font-size: var(--hx-type-size-base);
		}
		.console-chat :global(button:not(.floating-chat-bubble):not(.floating-chat-close)) {
			padding: var(--hx-space-6) var(--hx-space-8);
		}
	}
</style>
