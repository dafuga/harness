<script lang="ts">
	import { resolve } from '$app/paths';
	import { categories } from '../models/Desktop.types';
	import type { Workspace } from '../lib/stores/workspace.svelte';
	import Icon from './Icon.svelte';
	import RevisionPicker from './RevisionPicker.svelte';
	let { workspace }: { workspace: Workspace } = $props();
</script>

<header class="topbar">
	<a
		class="brand"
		href={resolve('/')}
		onclick={(e) => {
			e.preventDefault();
			void workspace.openProject();
		}}><span class="brand-mark">◈</span> Harness</a
	><span class="project-name">{workspace.snapshot?.project.name}</span>
	<nav aria-label="Catalog categories">
		{#each categories as category (category)}<a
				class:active={workspace.category === category}
				href={resolve('/harness/[...path]', { path: workspace.path(category).slice(9) })}
				onclick={(e) => {
					e.preventDefault();
					void workspace.navigate(workspace.path(category));
				}}><Icon name={category} /><span>{category[0].toUpperCase() + category.slice(1)}</span></a
			>{/each}
	</nav>
	<RevisionPicker {workspace} />
</header>
