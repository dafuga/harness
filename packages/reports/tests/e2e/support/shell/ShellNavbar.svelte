<script lang="ts">
	import HarnessHeader from '../../../../src/components/explorer-ui/HarnessHeader.svelte';
	import type { ExplorerLocation } from '../../../../src/models/Explorer.types';
	import {
		shellBranch,
		shellCommits,
		shellHref,
		shellIndex,
		shellMount,
		shellScope
	} from '../shellData';
	import { shellSearchEntries } from '../shellSearch';
	// The host of the shell in miniature: one address, kept in the browser history, and the header
	// the console calls. It gives the header what a host gives it and decides nothing else.
	const start: ExplorerLocation = { branch: shellBranch, commit: null, category: 'pages' };
	const kept = (): ExplorerLocation => (history.state as ExplorerLocation | null) ?? start;
	let location = $state(kept());
	let scope = $derived(shellScope(location));
	// A host reads a revision before it hands its entities over. `__searchLag` makes that read take
	// time, during which this host still hands over what it read before; `__searchExtra` adds rows.
	const { __searchLag: lag = 0, __searchExtra: extra = [] } = globalThis as unknown as {
		__searchLag?: number;
		__searchExtra?: Array<Record<string, string>>;
	};
	const read = (at: typeof scope) => [
		...shellSearchEntries(at),
		...extra.map((row) => ({ terms: [], ...row, commit: at.commit }))
	];
	let entries = $state(read(shellScope(kept())));
	$effect(() => {
		const fresh = read(scope);
		if (!lag) return void (entries = fresh);
		const timer = setTimeout(() => (entries = fresh), lag);
		return () => clearTimeout(timer);
	});
	// The links a host page of the console gave its header before the explorer.
	const links = [
		{ label: 'Reports', href: `${shellMount}/reports` },
		{ label: 'Analytics', href: `${shellMount}/analytics` }
	];
	function onroute(to: ExplorerLocation) {
		history.pushState(to, '', shellHref(to));
		location = to;
	}
	let navbar = $derived({
		repository: 'synthetic-repository',
		scope,
		index: shellIndex,
		commits: shellCommits(location.branch),
		href: shellHref,
		onroute,
		search: { entries }
	});
</script>

<svelte:window onpopstate={() => (location = kept())} />
<!-- The root names both frames, as a console that is moving from one to the other does. -->
<div class="hc-shell hx-shell">
	<HarnessHeader base={shellMount} {links} problem="" missing={null} {navbar} />
	<main class="hx-main">
		<h1 aria-label="Title in the explorer">Explorer shell</h1>
		<p>Synthetic fixture of the explorer shell. No repository is read.</p>
		<p>Address <output aria-label="Address">{shellHref(location)}</output></p>
		<p>Viewed commit <output aria-label="Viewed commit">{scope.commit}</output></p>
	</main>
</div>
<section class="hc-shell" aria-label="Frame of the console that was">
	<h1 aria-label="Title in the earlier frame">Explorer shell</h1>
</section>
