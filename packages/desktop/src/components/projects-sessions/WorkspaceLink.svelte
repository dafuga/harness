<!-- @harness-tier organism -->
<!-- @harness-atoms ../../../../reports/src/components/shared-primitives/atoms -->
<script lang="ts">
	import { base } from '$app/paths';
	import type { Snippet } from 'svelte';
	import type { Workspace } from '../../lib/stores/projects-sessions/workspace.svelte';
	let {
		workspace,
		to,
		class: style = '',
		label,
		title,
		children
	}: {
		workspace: Workspace;
		to: string;
		class?: string;
		/** What the link does, where its text alone does not say it. */
		label?: string;
		/** Short hover text for an icon-only link. */
		title?: string;
		children: Snippet;
	} = $props();
	/**
	 * Every workspace link is built by the workspace and resolved here against the base of the
	 * app that renders it, so no component cuts a prefix off a path.
	 */
	const href = $derived(base + to);
	/** A plain click opens the address here; a modified one is the browser's, such as a new tab. */
	function open(event: MouseEvent) {
		const modified = event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
		if (event.defaultPrevented || event.button !== 0 || modified) return;
		event.preventDefault();
		void workspace.navigate(to);
	}
</script>

<!-- Paths are validated by Workspace and shared across hosts with different generated route types. -->
<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
<hx-a class={style} {href} {title} aria-label={label} onclick={open}>{@render children()}</hx-a>
