<script lang="ts">
	import type { ExplorerEntity, ExplorerRelations } from '../../../models/Explorer.types';
	import { explorerKindCategory } from '../../../../../../src/utils/explorerRoute';
	import { entityLens, type EntityNav } from '../../../utils/entityLens';
	import { entityUsage } from './entityUsage';
	import EntityLink from '../EntityLink.svelte';
	import HarnessIcon from '../HarnessIcon.svelte';
	let {
		relations,
		nav,
		show = 'both',
		compact = false,
		removed = false
	}: {
		relations: ExplorerRelations;
		nav: EntityNav;
		/** Which of the two sections is drawn; an overview draws both. */
		show?: 'both' | 'used-in' | 'uses';
		/** Names only; a section of its own also shows each entity's purpose. */
		compact?: boolean;
		/** The shown commit removed the entity: its revision holds no relation of it. */
		removed?: boolean;
	} = $props();
	let usage = $derived(entityUsage(relations));
	const changed = ['direct', 'added'];
	const gone = 'Removed at this commit: ';
</script>

{#snippet row(item: ExplorerEntity, badge: boolean)}
	<li>
		<span>
			<EntityLink to={entityLens(nav.route, { category: item.category, entity: item.id })} {nav}
				>{item.name}</EntityLink
			>
			{#if badge}<span class="ex-pill">{item.role}</span>{/if}
			{#if changed.includes(item.change ?? '')}<span class="ex-pill gold">Changed</span>{/if}
			{#if !compact}<span class="ex-soft ex-block">{item.purpose}</span>{/if}
		</span>
	</li>
{/snippet}

<!-- What uses the entity and what it uses are two sections; neither names a file. -->
<div class="ex-relations">
	{#if show !== 'uses'}
		<section class="ex-card" aria-label="Used In">
			<h2>
				<HarnessIcon name="relationships" size={22} /> Used In
				<span class="ex-count">{usage.usedIn.length}</span>
			</h2>
			{#if usage.usedIn.length === 0}
				<p class="ex-soft">
					{removed
						? `${gone}nothing of this commit uses it.`
						: 'No page shows it and nothing else uses it.'}
				</p>
			{/if}
			<ul class="ex-related">
				{#each usage.usedIn as item (item.id)}{@render row(item, true)}{/each}
			</ul>
		</section>
	{/if}
	{#if show !== 'used-in'}
		<section class="ex-card" aria-label="Uses">
			<h2>
				<HarnessIcon name="layers" size={22} /> Uses
				<span class="ex-count">{usage.count}</span>
			</h2>
			{#if usage.count === 0}
				<p class="ex-soft">
					{removed
						? `${gone}what it used is not listed here.`
						: 'It uses no component, function, config or service.'}
				</p>
			{/if}
			{#each usage.uses as group, position (position)}
				<h3>
					<HarnessIcon name={group.icon} size={18} />
					{group.title} <span class="ex-count">{group.items.length}</span>
				</h3>
				<ul class="ex-related">
					{#each group.items as item (item.id)}{@render row(item, false)}{/each}
				</ul>
			{/each}
			{#if usage.other.length}
				<h3>
					<HarnessIcon name="file" size={18} /> Other
					<span class="ex-count">{usage.other.length}</span>
				</h3>
				<ul class="ex-related">
					{#each usage.other as item (item.id)}
						<li>
							<span>
								{#if explorerKindCategory(item.unit.kind) === 'functions'}
									<EntityLink
										to={entityLens(nav.route, { category: 'functions', entity: item.id })}
										{nav}>{item.name}</EntityLink
									>
								{:else}{item.name}{/if}
								<span class="ex-pill">{item.role}</span>
							</span>
						</li>
					{/each}
				</ul>
			{/if}
		</section>
	{/if}
</div>
