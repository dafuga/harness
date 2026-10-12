<script lang="ts">
	import type { ExplorerLocation } from '../../models/Explorer.types';
	import { harnessShell, plainClick, type HarnessNavbarInput } from '../../utils/harnessShell';
	import HarnessIcon from './HarnessIcon.svelte';
	import HarnessSelectors from './HarnessSelectors.svelte';
	let input: HarnessNavbarInput = $props();
	let view = $derived(harnessShell(input));
	let revision = $derived(view.revision);
	// A plain click stays in the application; any other is the link it is.
	function follow(event: MouseEvent, to: ExplorerLocation | null) {
		if (!to || !plainClick(event)) return;
		event.preventDefault();
		input.onroute(to);
	}
</script>

<header class="hx-nav">
	<a class="hx-brand" href={view.home.href} onclick={(event) => follow(event, view.home.to)}>
		<svg class="hx-mark" viewBox="0 0 32 32" width="30" height="30" aria-hidden="true">
			<path d="M17 29 30 16 17 3l-3.5 3.5L23 16l-9.5 9.5z" />
			<path d="M15 3 2 16l13 13 3.5-3.5L9 16l9.5-9.5z" />
		</svg>
		<span>Harness</span>
	</a>
	{#if input.repository}<span class="hx-repository">{input.repository}</span>{/if}
	<nav class="hx-categories" aria-label="Harness categories">
		{#each view.categories as item (item.id)}
			{#if item.href}
				<a
					href={item.href}
					aria-current={item.active ? 'page' : undefined}
					onclick={(event) => follow(event, item.to)}
					><HarnessIcon name={item.icon} size={24} /><span>{item.label}</span></a
				>
			{:else}
				<span class="hx-category" aria-disabled="true"
					><HarnessIcon name={item.icon} size={24} /><span>{item.label}</span></span
				>
			{/if}
		{/each}
	</nav>
	{#if revision && input.index}
		<HarnessSelectors
			index={input.index}
			branch={revision.branch}
			commit={revision.commit}
			commits={revision.commits}
			bases={null}
			from=""
			onbranch={(name) => input.onroute(revision.branchTo(name))}
			oncommit={(commit) => input.onroute(revision.commitTo(commit))}
			onbase={() => {}}
			tip={{
				note: revision.note,
				viewed: revision.viewed,
				href: revision.tip?.href ?? null,
				onfollow: () => revision.tip && input.onroute(revision.tip.to)
			}}
		/>
	{/if}
</header>
