<script lang="ts">
	import type { ExplorerEntity, ExplorerRelations } from '../../models/Explorer.types';
	import { entityLens, type EntityNav } from '../../utils/entityLens';
	import { categoryIcon, type HarnessIconName } from '../../utils/harnessIcons';
	import EntityLink from './EntityLink.svelte';
	import HarnessIcon from './HarnessIcon.svelte';
	import HarnessVerdict from './HarnessVerdict.svelte';
	let { relations, nav }: { relations: ExplorerRelations; nav: EntityNav } = $props();
	interface Section {
		title: string;
		icon: HarnessIconName;
		items: ExplorerEntity[];
		/** What the section says when it is empty. */
		none: string;
	}
	// Each kind is a section of its own; a component of a component is a component like any other.
	let sections = $derived<Section[]>([
		{
			title: 'Components',
			icon: categoryIcon.components,
			items: relations.components,
			none: 'It contains no component.'
		},
		{
			title: 'Functions',
			icon: categoryIcon.functions,
			items: relations.functions,
			none: 'It uses no function.'
		},
		{
			title: 'Configs',
			icon: categoryIcon.configs,
			items: relations.configs,
			none: 'It reads no config.'
		},
		{
			title: 'Services',
			icon: categoryIcon.services,
			items: relations.services,
			none: 'It calls no service.'
		},
		{
			title: 'Used on pages',
			icon: categoryIcon.pages,
			items: relations.pages,
			none: 'No page shows it.'
		},
		{
			title: 'Used by',
			icon: 'relationships',
			items: relations.usedBy,
			none: 'Nothing else uses it.'
		}
	]);
	const changed = ['direct', 'added'];
</script>

<div class="ex-relations">
	{#each sections as section, position (position)}
		<section class="ex-card" aria-label={section.title}>
			<h2>
				<HarnessIcon name={section.icon} size={22} />
				{section.title}
				<span class="ex-count">{section.items.length}</span>
			</h2>
			{#if section.items.length === 0}<p class="ex-soft">{section.none}</p>{/if}
			<ul class="ex-related">
				{#each section.items as item (item.id)}
					<li>
						<HarnessVerdict {...item.verdict} />
						<span>
							<EntityLink
								to={entityLens(nav.route, { category: item.category, entity: item.id })}
								{nav}>{item.name}</EntityLink
							>
							{#if changed.includes(item.change ?? '')}<span class="ex-pill gold">Changed</span
								>{/if}
							<span class="ex-soft ex-block">{item.purpose}</span>
						</span>
					</li>
				{/each}
			</ul>
		</section>
	{/each}
	{#if relations.support.length}
		<section class="ex-card" aria-label="Other dependencies">
			<h2>
				<HarnessIcon name="file" size={22} /> Other dependencies
				<span class="ex-count">{relations.support.length}</span>
			</h2>
			<p class="ex-soft">What it depends on that is not one of the five kinds.</p>
			<ul class="ex-related">
				{#each relations.support as item (item.id)}
					<li><span>{item.name} <span class="ex-pill">{item.role}</span></span></li>
				{/each}
			</ul>
		</section>
	{/if}
</div>
