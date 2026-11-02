<!-- @harness-tier organism -->
<!-- @harness-atoms ../shared-primitives/atoms -->
<!-- @harness-uid u_ka2gle2p6v -->
<script lang="ts">
	import { moduleResourceLocation } from '../../../../../src/helpers/module-system/moduleResourceLocation';
	import type { ExplorerLocation } from '../../models/explorer-ui/Explorer.types';
	import type { ExplorerScreenProps } from '../../models/explorer-ui/ExplorerScreen.types';
	import type {
		ModuleEntry
	} from '../../../../../src/services/module-system/moduleDefinition.types';
	import { plainClick } from '../../utils/explorer-ui/harnessShell';
	import ExplorerFrame from '../explorer-ui/ExplorerFrame.svelte';
	import CommandBlock from '../explorer-ui/explorer-kit/CommandBlock.svelte';
	import EmptyState from '../explorer-ui/explorer-kit/EmptyState.svelte';
	import Notice from '../explorer-ui/explorer-kit/Notice.svelte';
	import Card from '../explorer-ui/explorer-kit/Card.svelte';
	import ExplorerPluginCard from './plugins/ExplorerPluginCard.svelte';
	import PluginResourceCard from './plugins/PluginResourceCard.svelte';
	import PluginStatePills from './plugins/PluginStatePills.svelte';
	import PluginSteps from './plugins/PluginSteps.svelte';
	let host: ExplorerScreenProps = $props();
	const sources = { builtin: 'Provided by Harness', project: 'Defined by this project' };
	let catalog = $derived(
		host.head.modules && {
			...host.head.modules,
			modules: host.head.modules.modules.filter(
				(entry) =>
					entry.definition.visibility !== 'internal' &&
					(entry.source !== 'builtin' ||
						!entry.definition.includedByDefault ||
						entry.definition.testing)
			)
		}
	);
	let shown = $derived(catalog?.modules.find((item) => item.definition.id === host.route.entity));
	function at(screen: ExplorerLocation['screen'], entity?: string): ExplorerLocation {
		const { branch, commit } = host.route;
		return { branch, commit, category: 'pages', screen, ...(entity ? { entity } : {}) };
	}
	function follow(event: MouseEvent, to: ExplorerLocation) {
		if (!plainClick(event)) return;
		event.preventDefault();
		host.onroute(to);
	}
</script>

{#snippet link(to: ExplorerLocation, text: string)}
	<hx-a href={host.lens.href(to)} onclick={(event) => follow(event, to)}>{text}</hx-a>
{/snippet}
{#snippet library()}
	<hx-h1 id="mod-title">Plugins</hx-h1>
	<hx-p class="ex-lead">External capabilities and headless testing tools for your project.</hx-p>
	{#if !catalog}
		<EmptyState>No plugin catalog was indexed for this revision.</EmptyState>
	{:else}
		{#if catalog.gaps.length}
			<Notice>May be incomplete: {catalog.gaps.join('; ')}</Notice>
		{/if}
		{#if catalog.modules.length}
			<hx-div class="mod-grid">
				{#each catalog.modules as entry (entry.definition.id)}
					<ExplorerPluginCard {entry}>
						{#snippet title()}{@render link(
								at('modules', entry.definition.id),
								entry.definition.title
							)}{/snippet}
					</ExplorerPluginCard>
				{/each}
			</hx-div>
		{:else}
			<EmptyState>No plugins are defined at this revision.</EmptyState>
		{/if}
	{/if}
{/snippet}
{#snippet detail(entry: ModuleEntry)}
	{@const module = entry.definition}
	<hx-header class="ex-head-title">
		<hx-h1 id="mod-title">{module.title}</hx-h1>
		<PluginStatePills {entry} />
	</hx-header>
	<hx-p class="ex-lead">{module.description}</hx-p>
	<hx-p class="ex-soft">Version {module.version} · {sources[entry.source]}</hx-p>
	{#if !entry.installed}<CommandBlock label="Install" command={`harness plugin add ${module.id}`} />{/if}
	<Card as="section" labelledby="mod-setup">
		<hx-h2 id="mod-setup">Setup</hx-h2>
		<PluginSteps lines={module.instructions} />
	</Card>
	<hx-h2>Resource types</hx-h2>
	{#if module.testing}<CommandBlock label="Run headlessly" command={`harness plugin test ${module.id}`} />{/if}
	<hx-div class="mod-grid">
		{#each module.resources as resource (resource.id)}
			{@const list = entry.installed
				? moduleResourceLocation(host.route, module.id, resource)
				: null}
			<PluginResourceCard {entry} {resource}>
				{#snippet title()}{#if list}{@render link(list, resource.title)}{:else}{resource.title}{/if}{/snippet}
			</PluginResourceCard>
		{/each}
	</hx-div>
{/snippet}
<ExplorerFrame {host} registryRequired={false}>
	{#snippet children()}
		<hx-section
			class="ex-index"
			aria-labelledby="mod-title"
			data-harness-component="explorer-modules-screen"
		>
			{#if !host.route.entity}
				{@render library()}
			{:else}
				<hx-nav class="ex-crumbs" aria-label="Breadcrumb">
					<hx-ol>
						<hx-li>{@render link(at('modules'), 'Plugins')}</hx-li>
						<hx-li aria-current="page">{shown?.definition.title ?? 'Not found'}</hx-li>
					</hx-ol>
				</hx-nav>
				{#if shown}
					{@render detail(shown)}
				{:else}
					<hx-h1 id="mod-title">Plugin not found</hx-h1>
					<EmptyState>
						{catalog
							? `No plugin called “${host.route.entity}” is defined at this revision.`
							: 'No plugin catalog was indexed for this revision.'}
					</EmptyState>
				{/if}
			{/if}
		</hx-section>
	{/snippet}
</ExplorerFrame>

<style>
	.mod-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: var(--hx-space-14);
	}
	@media (max-width: 760px) {
		.mod-grid {
			grid-template-columns: minmax(0, 1fr);
		}
	}
</style>
