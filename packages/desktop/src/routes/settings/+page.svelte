<!-- @harness-tier page -->
<!-- @harness-atoms ../../../../reports/src/components/shared-primitives/atoms -->
<!-- @harness-uid u_pgijxbptc2 -->
<script lang="ts">
	import { resolve } from '$app/paths';
	import { onMount } from 'svelte';
	import AgentSettings from '../../components/agents-providers/AgentSettings.svelte';
	import { isWorkspacePath } from '../../utils/projects-sessions/workspaceRoute';
	import '../../lib/styles/workspace.css';
	import '../../lib/styles/design.css';
	const title = 'Settings';
	let back = $state('/');
	/** Only a workspace path of this app is returned to; any other address goes home. */
	function internal(from: string | null): string {
		if (!from || !/^\/(?![/\\])/.test(from)) return '/';
		try {
			const url = new URL(from, location.href);
			if (url.origin !== location.origin || url.host !== location.host) return '/';
			return isWorkspacePath(url.pathname) ? url.pathname + url.search : '/';
		} catch {
			return '/';
		}
	}
	onMount(() => {
		back = internal(new URLSearchParams(location.search).get('from'));
	});
</script>

<svelte:head>
	<title>{title}</title>
</svelte:head>

<hx-main class="settings-page" data-harness-view="settings">
	<hx-a class="settings-back" href={resolve(back as '/')}
		><hx-span aria-hidden="true">←</hx-span>
		{back === '/' ? 'Back to home' : 'Back to project'}</hx-a
	>
	<hx-h1>{title}</hx-h1>
	<AgentSettings />
</hx-main>

<style>
	/* The home's single centred column: a quiet way back, the title, then the settings card. */
	.settings-page {
		display: grid;
		gap: var(--hx-space-16);
		width: min(100%, 592px);
		margin: 0 auto;
		padding: var(--hx-space-48) var(--hx-space-16) var(--hx-space-40);
	}
	h1 {
		margin: 0;
	}
	.settings-back {
		justify-self: start;
		display: inline-flex;
		align-items: center;
		gap: var(--hx-space-6);
		min-height: 44px;
		color: var(--hx-color-text-muted);
		font-size: var(--hx-type-size-sm);
	}
	.settings-back:hover {
		color: var(--hx-color-text);
	}
</style>
