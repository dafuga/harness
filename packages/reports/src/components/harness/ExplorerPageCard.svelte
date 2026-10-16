<script lang="ts">
	import type { Evidence } from '../../models/Report.types';
	import type { CatalogRow } from '../../utils/entityCatalog';
	import { entityLens, type EntityNav } from '../../utils/entityLens';
	import EntityLink from './EntityLink.svelte';
	import HarnessAction from './HarnessAction.svelte';
	import HarnessIcon from './HarnessIcon.svelte';
	import HarnessVerdict from './HarnessVerdict.svelte';
	let {
		row,
		shot,
		mediaBase,
		nav
	}: {
		row: CatalogRow;
		/** The page's own screenshot at the shown revision, or its stated gap; never another's. */
		shot: Evidence | null;
		mediaBase: string;
		nav: EntityNav;
	} = $props();
	let to = $derived(entityLens(nav.route, { category: 'pages', entity: row.id }));
	let broken = $state(false);
	let pictured = $derived(Boolean(shot && !shot.missing && shot.file && !broken));
	const count = (total: number) => `${total} ${total === 1 ? 'component' : 'components'}`;
</script>

<article class="ex-page-card" aria-label={row.name}>
	<EntityLink {to} {nav} class="ex-thumb" label={`Open ${row.name}`}>
		{#if pictured && shot}
			<img
				src={mediaBase + shot.file}
				alt={`Screenshot of ${row.name}`}
				loading="lazy"
				onerror={() => (broken = true)}
			/>
		{:else}
			<span class="ex-thumb-gap">
				<HarnessIcon name="pages" size={28} />
				<span>No screenshot is recorded at this revision</span>
			</span>
		{/if}
	</EntityLink>
	<div class="ex-page-body">
		<h2><EntityLink {to} {nav}>{row.name}</EntityLink></h2>
		<p class="ex-soft">{row.summary}</p>
		<p class="ex-fact">
			<HarnessIcon name="layers" size={22} />
			<span>{count(row.components)}</span>
			{#if row.changed}<span class="ex-pill gold">Changed</span>{/if}
		</p>
		<p class="ex-fact">
			<HarnessIcon name="tests" size={22} />
			<HarnessVerdict {...row.verdict} framed />
		</p>
		<HarnessAction href={nav.href(to)} onclick={() => nav.go(to)} icon="arrow-right"
			>Open page</HarnessAction
		>
	</div>
</article>
