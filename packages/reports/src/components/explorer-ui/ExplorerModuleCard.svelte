<script lang="ts">
	import type { ExplorerCategory } from '../../models/explorer-ui/Explorer.types';
	import type { Evidence } from '../../models/reports-media/Report.types';
	import type { CatalogRow } from '../../utils/explorer-ui/entityCatalog';
	import type { SupportRow } from '../../utils/explorer-ui/entityUsage';
	import { entityLens, type EntityLens, type EntityNav } from '../../utils/explorer-ui/entityLens';
	import { shortCommit } from '../../helpers/strings/shortCommit';
	import { catalogShot } from '../../utils/explorer-ui/entityScreens';
	import { categoryIcon } from '../../utils/explorer-ui/harnessIcons';
	import ExplorerUsage from '../ExplorerUsage.svelte';
	import EntityLink from './EntityLink.svelte';
	import HarnessIcon from './HarnessIcon.svelte';
	let {
		row,
		nav,
		lens,
		mediaBase,
		category,
		shot
	}: {
		/** A collection's row, or what a module uses that no collection lists. */
		row: CatalogRow | SupportRow;
		nav: EntityNav;
		lens: EntityLens;
		mediaBase: string;
		/** The collection it is listed in; the row's own kind when not given. */
		category?: ExplorerCategory | null;
		/** A visual card's own screenshot, or null for its gap; read from the lens when omitted. */
		shot?: Evidence | null;
	} = $props();
	// A dependency no collection lists has no kind of its own; only a private function has a page.
	let entry = $derived('support' in row ? null : row);
	let opens = $derived('support' in row ? row.opens : null);
	let kind = $derived(category ?? entry?.entity.category);
	// Pages, layouts and components are pictured; helpers, services, models and configs are not.
	let page = $derived(kind === 'pages');
	let visual = $derived(page || kind === 'components' || kind === 'layouts');
	// A config opens its values as its row did; other code opens its contract. Nothing is invented.
	let to = $derived.by(() => {
		if (!entry) return opens && entityLens(nav.route, { category: opens, entity: row.id });
		const tab = visual || kind === 'configs' ? undefined : 'contract';
		const helper = entry.helper?.name;
		return entityLens(nav.route, { category: kind, entity: entry.entity.id, helper, tab });
	});
	// The entity's own capture at the shown revision, or null for its gap; never another's.
	let capture = $derived.by(() => {
		if (shot !== undefined || !visual || !entry) return shot ?? null;
		return catalogShot(lens.evidence(entry.entity.unit), entry.entity.unit.preview, true);
	});
	let file = $derived(capture && !capture.missing ? capture.file : '');
	// A failure belongs to one file: the file of another revision is tried afresh.
	let failed = $state('');
	$effect(() => {
		if (file) failed = '';
	});
	let pictured = $derived(Boolean(file) && failed !== file);
	// Only a capture the record calls fresh was taken at this revision; any other was reused.
	let taken = $derived(capture?.standing === 'Fresh capture' ? 'Captured at' : 'Reused from');
	let origin = $derived(`${taken} ${shortCommit(capture?.source ?? '')}`);
	let provenance = $derived(pictured && capture ? `${capture.title} · ${origin}` : undefined);
	/** A call from this revision's documented values; unspecified arguments stay named variables. */
	function invocation({ helper, entity: { unit } }: CatalogRow): string {
		const name = helper?.name ?? '';
		if (!name) return unit.title;
		const documented = unit.documentation?.examples[0]?.input;
		const values =
			unit.contract.inputs[0]?.name.startsWith(`${name}.`) &&
			documented &&
			typeof documented === 'object' &&
			!Array.isArray(documented)
				? (documented as Record<string, unknown>)
				: {};
		const args = (helper?.inputs ?? [])
			.filter((input) => input.name.startsWith(`${name}.`))
			.map((input) => {
				const parameter = input.name.split('.').at(-1)!;
				if (Object.hasOwn(values, parameter)) return JSON.stringify(values[parameter]);
				const declared = unit.contract.inputs.find((field) => field.name === input.name);
				if (declared?.examples?.length) return JSON.stringify(declared.examples[0]);
				return parameter;
			});
		return `${name}(${args.join(', ')})`;
	}
	let call = $derived(entry?.helper ? invocation(entry) : row.name);
	const hint = 'Example usage; arguments without recorded sample values remain named variables.';
</script>

{#snippet picture()}
	{#if pictured && capture}
		<img
			src={mediaBase + file}
			alt={`Screenshot of ${row.name}`}
			loading="lazy"
			decoding="async"
			onerror={() => (failed = file)}
		/>
	{:else}
		<span class="ex-thumb-gap">
			{#if kind}
				<HarnessIcon name={categoryIcon[kind]} size={28} />
			{/if}
			<span>No screenshot is recorded at this revision</span>
		</span>
	{/if}
{/snippet}

{#snippet usage()}
	<ExplorerUsage consumers={row.usedIn ?? []} {nav} {lens} {mediaBase} />
{/snippet}

<!-- Every module card: its name, its own screenshot when it has one, and one Used In footer. -->
<article
	class:ex-page-card={visual}
	class:ex-page-minimal={page}
	class:ex-function-tile={!visual}
	aria-label={row.name}
	data-harness-component="explorer-ui-explorer-module-card"
>
	{#if page && to}
		<EntityLink {to} {nav} class="ex-page-open" label={`Open ${row.name}`} title={provenance}>
			<h2>{row.name}</h2>
			<span class="ex-thumb">{@render picture()}</span>
		</EntityLink>
		<!-- Beside the page's link, never inside it: a link holds no other link. -->
		{@render usage()}
	{:else if visual && to}
		<figure class="ex-card-shot">
			<EntityLink {to} {nav} class="ex-thumb" label={`Open ${row.name}`}>
				{@render picture()}
			</EntityLink>
		</figure>
		<div class="ex-page-body">
			<h2><EntityLink {to} {nav}>{row.name}</EntityLink></h2>
			{@render usage()}
		</div>
	{:else if to}
		<EntityLink {to} {nav} class="ex-function-call" title={entry?.helper ? hint : undefined}>
			<code>{call}</code>
		</EntityLink>
		{@render usage()}
	{:else}
		<!-- A dependency without a page of its own is named, never linked to an invented one. -->
		<span class="ex-function-call"><code>{call}</code></span>
		{@render usage()}
	{/if}
</article>

<style>
	/* Any code card: its call or name in code type above its Used In list. */
	.ex-function-tile {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		align-content: start;
		align-items: center;
		min-width: 0;
		border: var(--hx-border-thin) solid var(--ex-line);
		border-radius: var(--ex-radius);
		background: var(--ex-surface);
	}
	.ex-function-tile code {
		display: block;
		max-height: 6em;
		overflow: auto;
		white-space: pre-wrap;
		overflow-wrap: anywhere;
		font: var(--hx-style-code);
	}
	.ex-function-tile :global(.ex-function-call) {
		display: block;
		min-width: 0;
		padding: var(--hx-space-16) var(--hx-space-16) var(--hx-space-8);
		border-radius: inherit;
	}
	.ex-function-tile > :global(.ex-usage) {
		padding: 0 var(--hx-space-16) var(--hx-space-14);
	}
	.ex-page-card.ex-page-minimal {
		grid-template-columns: minmax(0, 1fr);
		gap: var(--hx-space-12);
	}
	/* A layout or component card, wherever listed: its own capture above its title and Used In. */
	.ex-page-card:not(.ex-page-minimal) {
		grid-template-columns: minmax(0, 1fr);
		grid-template-rows: auto 1fr;
		gap: var(--hx-space-14);
		min-width: 0;
	}
	.ex-page-card .ex-page-body {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: var(--hx-space-10);
	}
	.ex-page-card .ex-page-body h2 {
		font-size: var(--hx-type-size-xl);
	}
	:global(.ex-page-open) {
		display: grid;
		gap: var(--hx-space-14);
		min-width: 0;
	}
	:global(.ex-page-open h2) {
		font-size: var(--hx-type-size-xl);
		overflow-wrap: anywhere;
	}
	:global(.ex-page-open:focus-visible) {
		outline: var(--hx-border-thick) solid var(--ex-gold);
		outline-offset: var(--hx-space-6);
	}
</style>
