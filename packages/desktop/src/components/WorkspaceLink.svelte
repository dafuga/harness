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
</script>

<a
	class={style}
	{href}
	aria-label={label}
	onclick={(event) => {
		event.preventDefault();
		void workspace.navigate(to);
	}}>{@render children()}</a
>
