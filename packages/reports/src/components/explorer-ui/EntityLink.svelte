<!-- @harness-tier molecule -->
<!-- @harness-atoms ../shared-primitives/atoms -->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLAnchorAttributes } from 'svelte/elements';
	import type { ExplorerLocation } from '../../models/explorer-ui/Explorer.types';
	import type { EntityNav } from '../../utils/explorer-ui/entityLens';
	import { plainClick } from '../../utils/explorer-ui/harnessShell';
	// Any other anchor attribute is passed on; the address and the click stay this link's own.
	let {
		to,
		nav,
		label,
		children,
		...rest
	}: Omit<HTMLAnchorAttributes, 'href' | 'onclick' | 'children'> & {
		to: ExplorerLocation;
		nav: EntityNav;
		/** The accessible name, when the visible text alone does not say where the link leads. */
		label?: string;
		children: Snippet;
	} = $props();
	// A modified click, or any other button, stays the browser's: it may open another tab.
	function follow(event: MouseEvent) {
		if (!plainClick(event)) return;
		event.preventDefault();
		nav.go(to);
	}
</script>

<hx-a
	aria-label={label}
	{...rest}
	href={nav.href(to)}
	onclick={follow}
	data-harness-component="harness-entity-link">{@render children()}</hx-a
>
