<!-- @harness-tier organism -->
<!-- @harness-atoms ../../../../reports/src/components/shared-primitives/atoms -->
<script lang="ts">
	import BrandMark from '$shared/BrandMark.svelte';
	import type { Snippet } from 'svelte';
	import type { DesktopProject } from '../../models/projects-sessions/ProjectContext.types';
	import GameCreate from '../game-authoring/GameCreate.svelte';
	let {
		available,
		local = true,
		busy,
		open,
		projects = [],
		choose = () => {},
		children
	}: {
		available: boolean;
		/** False on a phone: its projects are those of a computer, and it has no folder to open. */
		local?: boolean;
		busy: boolean;
		open: () => void;
		projects?: DesktopProject[];
		choose?: (projectId: string) => void;
		children?: Snippet;
	} = $props();
	const remote = 'The projects of your computer appear here once this phone is connected.';
	const place = $derived(local ? 'On this device' : 'On your computer');
	const hint = $derived.by(() => {
		if (!local) return projects.length ? 'Choose a project of your computer.' : remote;
		return available
			? 'Choose a local Git project to begin.'
			: 'Browser preview · read-only. Open the desktop app to choose a local project.';
	});
</script>

<hx-main class="project-gate">
	<hx-div class="brand-mark"><BrandMark /></hx-div>
	<hx-h1>Harness</hx-h1>
	<hx-p>Understand your project. Design what comes next.</hx-p>
	{#if local}<hx-button class="primary" disabled={!available || busy} onclick={open}
			>Open Project</hx-button
		>{/if}
	<hx-p class="muted">{hint}</hx-p>
	<!-- A new project is made on this device, so a phone or a browser preview offers none. -->
	{#if available && local}<GameCreate />{/if}
	{#if projects.length}<hx-section class="recent-projects" aria-label="Recent projects">
			<hx-h2>Recent projects</hx-h2>
			{#each projects as item (item.id)}<hx-button
					type="button"
					disabled={busy}
					aria-label={`Open ${item.name}`}
					onclick={() => choose(item.id)}
					><hx-strong>{item.name}</hx-strong><hx-small
						>{item.kind === 'shared' ? 'Shared project' : item.root || place}</hx-small
					></hx-button
				>{/each}
		</hx-section>{/if}{@render children?.()}
</hx-main>
