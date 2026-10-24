<!-- @harness-tier layout -->
<!-- @harness-atoms ../components/shared-primitives/atoms -->
<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import ConsoleChat from '../components/planning-collaboration/ConsoleChat.svelte';
	const navigate = (path: string, replace: boolean) =>
		void goto('/harness' + path, { replaceState: replace, noScroll: true, keepFocus: true });
	import '../lib/styles/base.css';
	import '../lib/styles/base-2.css';
	import '../lib/styles/base-3.css';
	import '../lib/styles/gallery.css';
	import '../lib/styles/gallery-2.css';
	let { children }: { children: import('svelte').Snippet } = $props();
</script>

{@render children()}

{#if /^\/harness\/(branch|commit)\//.test(page.url.pathname)}
	<ConsoleChat base="/harness" path={page.url.pathname.slice(8) + page.url.search} {navigate} />
{/if}
