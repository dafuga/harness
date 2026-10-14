<script lang="ts">
	import { resolve } from '$app/paths';
	import type { Snippet } from 'svelte';
	import type { Workspace } from '../lib/stores/workspace.svelte';
	let {
		workspace,
		to,
		class: style = '',
		label,
		children
	}: {
		workspace: Workspace;
		to: string;
		class?: string;
		/** What the link does, where its text alone does not say it. */
		label?: string;
		children: Snippet;
	} = $props();
	/**
	 * Every workspace link is built by the workspace and resolved here against the base of the
	 * app that renders it, so no component cuts a prefix off a path.
	 */
	const href = $derived(resolve(to as '/'));
	/** A plain click opens the address here; a modified one is the browser's, such as a new tab. */
	function open(event: MouseEvent) {
		const modified = event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
		if (event.defaultPrevented || event.button !== 0 || modified) return;
		event.preventDefault();
		void workspace.navigate(to);
	}
</script>

<a class={style} {href} aria-label={label} onclick={open}>{@render children()}</a>
