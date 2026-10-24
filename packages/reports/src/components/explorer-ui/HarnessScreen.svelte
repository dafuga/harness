<!-- @harness-tier organism -->
<!-- @harness-atoms ../shared-primitives/atoms -->
<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import '../../lib/styles/harness.css';
	import type { ExplorerScreen } from '../../models/explorer-ui/ExplorerScreen.types';
	import HarnessConsole from './HarnessConsole.svelte';
	let {
		title,
		content
	}: {
		/** What this screen of the explorer is called, for the title of its document. */
		title: string;
		/** The component that renders this screen; a page names its own and there is no other. */
		content: ExplorerScreen;
	} = $props();
	const base = '/harness';
	// Each branch, commit, category and entity is a page of its own route, so the router keeps
	// its history: back, forward and a reload show the same scope. The console places the view.
	const navigate = (path: string, replace: boolean) =>
		goto(base + path, { replaceState: replace, noScroll: true, keepFocus: true });
</script>

<svelte:head><title>{title} · Harness</title></svelte:head>
<HarnessConsole
	{base}
	path={page.url.pathname.slice(base.length) + page.url.search}
	{navigate}
	{content}
/>
