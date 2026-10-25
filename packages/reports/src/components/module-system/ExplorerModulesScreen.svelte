<!-- @harness-tier organism -->
<!-- @harness-atoms ../shared-primitives/atoms -->
<script lang="ts">
	import type { ExplorerLocation } from '../../models/explorer-ui/Explorer.types';
	import type { ExplorerScreenProps } from '../../models/explorer-ui/ExplorerScreen.types';
	import type {
		ModuleEntry,
		ModuleResource
	} from '../../../../../src/services/module-system/moduleDefinition.types';
	import { plainClick } from '../../utils/explorer-ui/harnessShell';
	import ExplorerFrame from '../explorer-ui/ExplorerFrame.svelte';
	let host: ExplorerScreenProps = $props();
	const sources = { builtin: 'Built into Harness', project: 'Defined by this project' };
	// Only the shown revision's own catalog: nothing is read from the working copy or another commit.
	let catalog = $derived(host.head.modules);
	let shown = $derived(catalog?.modules.find((item) => item.definition.id === host.route.entity));
	/** A module screen at the shown branch and commit; no helper, section or tab is carried over. */
	function at(screen: ExplorerLocation['screen'], entity?: string): ExplorerLocation {
		const { branch, commit } = host.route;
		return { branch, commit, category: 'pages', screen, ...(entity ? { entity } : {}) };
	}
	// A modified click, or another button, stays the browser's so a new tab can open it.
	function follow(event: MouseEvent, to: ExplorerLocation) {
		if (!plainClick(event)) return;
		event.preventDefault();
		host.onroute(to);
	}
</script>

{#snippet link(to: ExplorerLocation, text: string)}
	<hx-a href={host.lens.href(to)} onclick={(event) => follow(event, to)}>{text}</hx-a>
{/snippet}

<!-- A command is copied into a terminal: this page installs and generates nothing itself. -->
{#snippet command(label: string, text: string)}
	<hx-figure class="mod-command">
		<hx-figcaption>{label}</hx-figcaption>
		<hx-pre><hx-code>{text}</hx-code></hx-pre>
	</hx-figure>
{/snippet}

<!-- Installation is what this revision's state file records, never a guess. -->
{#snippet state(entry: ModuleEntry)}
	{@const label = entry.installed ? 'Installed' : 'Available'}
	<hx-span class="ex-pill mod-state" data-state={label}>{label}</hx-span>
{/snippet}

<!-- Instructions are shown as text; no manifest content is read as markup or run. -->
{#snippet steps(lines: string[])}
	<hx-ul class="ex-reasons mod-steps">
		{#each lines as line, position (position)}<hx-li>{line}</hx-li>{/each}
	</hx-ul>
{/snippet}

{#snippet card(entry: ModuleEntry)}
	{@const module = entry.definition}
	<hx-article class="ex-card mod-card">
		<hx-header class="mod-head">
			<hx-h2>{@render link(at('modules', module.id), module.title)}</hx-h2>
			{@render state(entry)}
		</hx-header>
		<hx-p class="mod-text">{module.description}</hx-p>
		<hx-ul class="mod-kinds" aria-label={`${module.title} resource types`}>
			{#each module.resources as resource (resource.id)}
				<hx-li class="ex-pill">{resource.title}</hx-li>
			{/each}
		</hx-ul>
		{#if !entry.installed}{@render command('Install', `harness module add ${module.id}`)}{/if}
	</hx-article>
{/snippet}

{#snippet library()}
	<hx-h1 id="mod-title">Modules</hx-h1>
	<hx-p class="ex-lead">Project capabilities, and the resources each one generates.</hx-p>
	{#if !catalog}
		<hx-p class="ex-empty">No module catalog was indexed for this revision.</hx-p>
	{:else}
		{#if catalog.gaps.length}
			<hx-p class="mod-text" role="note">May be incomplete: {catalog.gaps.join('; ')}</hx-p>
		{/if}
		{#if catalog.modules.length}
			<hx-div class="mod-grid">
				{#each catalog.modules as entry (entry.definition.id)}{@render card(entry)}{/each}
			</hx-div>
		{:else}
			<hx-p class="ex-empty">No modules are defined at this revision.</hx-p>
		{/if}
	{/if}
{/snippet}

<!-- Generation needs the module installed first, so an available module says so. -->
{#snippet kind(entry: ModuleEntry, resource: ModuleResource)}
	{@const id = entry.definition.id}
	{@const list = entry.installed ? at('module-resources', `${id}.${resource.id}`) : null}
	<hx-article class="ex-card mod-card">
		<hx-h3
			>{#if list}{@render link(list, resource.title)}{:else}{resource.title}{/if}</hx-h3
		>
		{@render steps(resource.instructions)}
		{@render command(
			entry.installed ? 'Generate' : 'Generate, once installed',
			`harness module generate ${id} ${resource.id} Example`
		)}
	</hx-article>
{/snippet}

{#snippet detail(entry: ModuleEntry)}
	{@const module = entry.definition}
	<hx-header class="ex-head-title">
		<hx-h1 id="mod-title">{module.title}</hx-h1>
		{@render state(entry)}
	</hx-header>
	<hx-p class="ex-lead">{module.description}</hx-p>
	<hx-p class="ex-soft">Version {module.version} · {sources[entry.source]}</hx-p>
	{#if !entry.installed}{@render command('Install', `harness module add ${module.id}`)}{/if}
	<hx-section class="ex-card" aria-labelledby="mod-setup">
		<hx-h2 id="mod-setup">Setup</hx-h2>
		{@render steps(module.instructions)}
	</hx-section>
	<hx-h2>Resource types</hx-h2>
	<hx-div class="mod-grid">
		{#each module.resources as resource (resource.id)}{@render kind(entry, resource)}{/each}
	</hx-div>
{/snippet}

<!-- The library is read from the selected revision, whether or not it has a unit registry. -->
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
						<hx-li>{@render link(at('modules'), 'Modules')}</hx-li>
						<hx-li aria-current="page">{shown?.definition.title ?? 'Not found'}</hx-li>
					</hx-ol>
				</hx-nav>
				{#if shown}
					{@render detail(shown)}
				{:else}
					<hx-h1 id="mod-title">Module not found</hx-h1>
					<hx-p class="ex-empty">
						{catalog
							? `No module called “${host.route.entity}” is defined at this revision.`
							: 'No module catalog was indexed for this revision.'}
					</hx-p>
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
	.mod-card :is(h2, h3) {
		color: var(--ex-text);
		font-size: var(--hx-type-size-lg);
		overflow-wrap: anywhere;
	}
	.mod-head,
	.mod-kinds {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--hx-space-6) var(--hx-space-10);
	}
	.mod-head {
		justify-content: space-between;
	}
	.mod-text,
	.mod-steps {
		color: var(--ex-soft);
		font-size: var(--hx-type-size-sm);
		overflow-wrap: anywhere;
	}
	.mod-state[data-state='Available'] {
		border-style: dashed;
		background: transparent;
		color: var(--ex-muted);
	}
	.mod-steps,
	.mod-command {
		display: grid;
		gap: var(--hx-space-6);
		min-width: 0;
	}
	.mod-command figcaption {
		color: var(--ex-muted);
		font-size: var(--hx-type-size-compact);
	}
	.mod-command pre {
		margin: 0;
		padding: var(--hx-space-10) var(--hx-space-12);
		border: var(--hx-border-thin) solid var(--ex-line);
		border-radius: var(--hx-radius-small);
		background: var(--hx-color-background);
		color: var(--ex-text);
		font-size: var(--hx-type-size-sm);
		white-space: pre-wrap;
		overflow-wrap: anywhere;
	}
	@media (max-width: 760px) {
		.mod-grid {
			grid-template-columns: minmax(0, 1fr);
		}
	}
</style>
