<!-- @harness-tier organism -->
<!-- @harness-atoms ../../../../reports/src/components/shared-primitives/atoms -->
<script lang="ts">
	import { explorerName } from '../../../../reports/src/utils/explorerName';
	import type { Category, Relationship } from '../../models/development-tooling/Desktop.types';
	import type { Workspace } from '../../lib/stores/projects-sessions/workspace.svelte';
	import PlanBadge from '../planning-collaboration/PlanBadge.svelte';
	import Icon from './Icon.svelte';
	import WorkspaceLink from '../projects-sessions/WorkspaceLink.svelte';
	let {
		relationships,
		workspace,
		direction
	}: {
		relationships: Relationship[];
		workspace: Workspace;
		/** Which side is listed: what uses the entity, or what it uses. */
		direction: Relationship['direction'];
	} = $props();
	/** Each kind as a group of what is used is headed, and as one user of the entity is badged. */
	const kinds: Record<Category, [string, string]> = {
		pages: ['Pages', 'Page'],
		layouts: ['Layouts', 'Layout'],
		components: ['Components', 'Component'],
		functions: ['Functions', 'Function'],
		configs: ['Configs', 'Config'],
		services: ['Services', 'Service'],
		models: ['Models', 'Model']
	};
	const other: [string, string] = ['Other', 'Other'];
	const kind = (item: Relationship) => (item.category ? kinds[item.category] : other);
	/** A related code unit keeps its identifier; pages keep their screen labels. */
	const named = (item: Relationship) =>
		explorerName({
			id: item.id,
			kind: item.category === 'pages' ? 'page' : 'module',
			title: item.title
		});
	const title = $derived(direction === 'uses' ? 'Uses' : 'Used In');
	/** What was recorded on this side, each entity once. */
	const items = $derived([
		...new Map(
			relationships
				.filter((item) => item.direction === direction)
				.map((item) => [item.id, item] as const)
		).values()
	]);
	/** What the entity uses stays apart by kind; what uses it is one list, each with its kind. */
	const groups = $derived(
		direction === 'uses'
			? [...Object.values(kinds), other]
					.map(([many]) => ({ title: many, items: items.filter((item) => kind(item)[0] === many) }))
					.filter((group) => group.items.length > 0)
			: [{ title: '', items }]
	);
</script>

<hx-section class="panel" aria-label={title}>
	<hx-h2>{title} <hx-span class="count">{items.length}</hx-span></hx-h2>
	{#if items.length === 0}
		<hx-p class="muted">
			{direction === 'uses' ? 'No dependency is recorded.' : 'Nothing recorded uses it.'}
		</hx-p>
	{/if}
	{#each groups as group (group.title)}
		{#if group.title}<hx-h3
				>{group.title} <hx-span class="count">{group.items.length}</hx-span></hx-h3
			>{/if}
		<hx-div class="relationships">
			{#each group.items as item (item.id)}<hx-article class="relationship">
					<Icon name={item.category || 'components'} />
					<hx-div>
						{#if item.category}<WorkspaceLink
								{workspace}
								to={workspace.path(item.category, item.id)}>{named(item)}</WorkspaceLink
							>{:else}<hx-span>{named(item)}</hx-span>{/if}
					</hx-div>
					{#if direction === 'used-by'}<hx-span class="chip">{kind(item)[1]}</hx-span>{/if}
					{#if item.hasPlan}<PlanBadge />{/if}
				</hx-article>{/each}
		</hx-div>
	{/each}
</hx-section>
