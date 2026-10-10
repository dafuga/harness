<script lang="ts">
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
	// Outside an application router the console keeps its own place in the browser history.
	const current = () => location.pathname.slice(base.length);
	let path = $state(current());
	function navigate(next: string, replace: boolean) {
		if (replace) history.replaceState(history.state, '', base + next);
		else history.pushState(null, '', base + next);
		path = next;
	}
</script>

<svelte:window onpopstate={() => (path = current())} />
<HarnessConsole {base} {path} {navigate} {links} {exportable} />
