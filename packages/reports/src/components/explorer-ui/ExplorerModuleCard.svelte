<!-- @harness-tier organism -->
<!-- @harness-atoms ../shared-primitives/atoms -->
<script lang="ts">
	import Card from './explorer-kit/Card.svelte';
	import type { ExplorerCategory } from '../../models/explorer-ui/Explorer.types';
	import type { Evidence } from '../../models/reports-media/Report.types';
	import type { CatalogRow } from '../../utils/explorer-ui/entityCatalog';
	import type { SupportRow } from '../../utils/explorer-ui/entityUsage';
	import { entityLens, type EntityLens, type EntityNav } from '../../utils/explorer-ui/entityLens';
	import { shortCommit } from '../../helpers/strings/shortCommit';
	import { catalogShot } from '../../utils/explorer-ui/entityScreens';
	import { categoryIcon } from '../../utils/explorer-ui/harnessIcons';
	import ExplorerUsage from './ExplorerUsage.svelte';
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
	const methods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];
	// An API shows the HTTP methods it exports, none assumed, before the route that names its link.
	let owned = $derived(kind === 'apis' ? (entry?.entity.unit.owns.symbols ?? []) : []);
	let served = $derived(methods.filter((method) => owned.includes(method)));
	let named = $derived(served.length ? row.name : undefined);
	let call = $derived(entry?.helper ? invocation(entry) : [...served, row.name].join(' '));
	const hint = 'Example usage; arguments without recorded sample values remain named variables.';
	let tip = $derived(entry?.helper ? hint : undefined);
</script>

{#snippet picture()}
	{#if pictured && capture}
		<hx-img
			src={mediaBase + file}
			alt={`Screenshot of ${row.name}`}
			loading="lazy"
			decoding="async"
			onerror={() => (failed = file)}
		/>
	{:else}
		<hx-span class="ex-thumb-gap">
			{#if kind}
				<HarnessIcon name={categoryIcon[kind]} size={28} />
			{/if}
			<hx-span>
				{file && failed === file
					? 'Screenshot could not be loaded.'
					: 'No screenshot is recorded at this revision'}
			</hx-span>
		</hx-span>
	{/if}
{/snippet}

{#snippet usage()}
	{#if !page || row.usedIn?.length}<ExplorerUsage
			consumers={row.usedIn ?? []}
			{nav}
			{lens}
			{mediaBase}
		/>{/if}
{/snippet}

<Card
	variant="module"
	tone={[visual ? 'ex-page-card' : 'ex-function-tile', page ? 'ex-page-minimal' : '']
		.filter(Boolean)
		.join(' ')}
	label={row.name}
	component="explorer-ui-explorer-module-card"
>
	{#if page && to}
		<EntityLink {to} {nav} class="ex-page-open" label={`Open ${row.name}`} title={provenance}>
			<hx-h2>{row.name}</hx-h2>
			<hx-span class="ex-thumb">{@render picture()}</hx-span>
		</EntityLink>
		<!-- Beside the page's link, never inside it: a link holds no other link. -->
		{@render usage()}
	{:else if visual && to}
		<hx-figure class="ex-card-shot">
			<EntityLink {to} {nav} class="ex-thumb" label={`Open ${row.name}`}>
				{@render picture()}
			</EntityLink>
		</hx-figure>
		<hx-div class="ex-page-body">
			<hx-h2><EntityLink {to} {nav}>{row.name}</EntityLink></hx-h2>
			{@render usage()}
		</hx-div>
	{:else if to}
		<EntityLink {to} {nav} class="ex-function-call" label={named} title={tip}>
			<hx-code>{call}</hx-code>
		</EntityLink>
		{@render usage()}
	{:else}
		<!-- A dependency without a page of its own is named, never linked to an invented one. -->
		<hx-span class="ex-function-call"><hx-code>{call}</hx-code></hx-span>
		{@render usage()}
	{/if}
</Card>

<style>
	@import './explorerModuleCard.css';
</style>
