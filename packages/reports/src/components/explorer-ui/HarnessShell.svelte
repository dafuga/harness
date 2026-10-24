<!-- @harness-tier organism -->
<!-- @harness-atoms ../shared-primitives/atoms -->
<script lang="ts">
	import ExplorerContent from './ExplorerContent.svelte';
	import HarnessConsole from './HarnessConsole.svelte';
	let {
		base,
		links = [],
		exportable = true
	}: {
		base: string;
		links?: Array<{ label: string; href: string }>;
		exportable?: boolean;
	} = $props();
	// This host stands alone, so it names the screen itself: the generic content, which renders
	// whatever the address asks for. The console has no screen of its own.
	// Outside an application router the console keeps its own place in the browser history. The
	// query belongs to that place: it holds the tab of a section, and an earlier address whole.
	const current = () => location.pathname.slice(base.length) + location.search;
	let path = $state(current());
	function navigate(next: string, replace: boolean) {
		if (replace) history.replaceState(history.state, '', base + next);
		else history.pushState(null, '', base + next);
		path = next;
	}
</script>

<svelte:window onpopstate={() => (path = current())} />
<HarnessConsole {base} {path} {navigate} {links} {exportable} content={ExplorerContent} />
