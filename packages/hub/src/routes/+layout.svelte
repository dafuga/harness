<!-- @harness-tier layout -->
<!-- @harness-atoms ../../../reports/src/components/shared-primitives/atoms -->
<!-- @harness-uid u_6bq2jpavns -->
<script lang="ts">
	import { onMount, type Snippet } from 'svelte';
	import '$desktop/lib/styles/workspace.css';
	import '$desktop/lib/styles/design.css';
	import '../lib/styles/hub.css';
	import '../lib/styles/hub-list.css';
	import { provideBrowser } from './browserContext';
	import { page } from '$app/state';
	import { provideHomeCosChat } from '$reports/components/projects-sessions/hub-home/hubHomeChatContext.svelte';
	import { provideHubHomeSource } from '../components/projects-sessions/hubHomeSource.svelte';
	import HubAgentDock from '../components/projects-sessions/HubAgentDock.svelte';
	import { hubDockPage } from '../utils/networking-security/hubDockPage';
	let { children }: { children: Snippet } = $props();
	const browser = provideBrowser();
	const { session } = browser;
	const docked = $derived(hubDockPage(page.route.id));
	const source = provideHubHomeSource(browser, () => (docked ? session.actor?.id : undefined));
	// An answer given on Home and in the dock is the same answer.
	provideHomeCosChat(source.refresh);
	onMount(() => void session.refresh());
</script>

{@render children()}
{#if session.actor && docked}
	{#key session.actor.id}<HubAgentDock />{/key}
{/if}
