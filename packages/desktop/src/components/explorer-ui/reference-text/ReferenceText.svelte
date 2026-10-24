<script lang="ts">
	import type { Workspace } from '../../../lib/stores/projects-sessions/workspace.svelte';
	import type { CatalogEntity } from '../../../models/development-tooling/Desktop.types';
	import { entityReferences } from './entityReferences';
	import { unitLinks } from './unitLinks';
	import Icon from '../../shared-primitives/Icon.svelte';
	import WorkspaceLink from '../../projects-sessions/WorkspaceLink.svelte';
	/**
	 * Agent or person text with its `[[unit:<id>]]` references as links to units of the shown
	 * project at the shown revision. Everything else, an unknown reference included, is the text
	 * as written; nothing in it is read as markup. It adds no element around the text.
	 */
	let {
		text,
		workspace,
		entity = null,
		history = false
	}: {
		text: string;
		workspace: Workspace;
		/** The entity whose details are in view; it is named before the catalog lists it. */
		entity?: CatalogEntity | null;
		/** Whether a reference opens the unit's commit history rather than its details. */
		history?: boolean;
	} = $props();
	const parts = $derived.by(() => {
		const link = unitLinks(workspace, entity, { history });
		return entityReferences(text).map((part) => ({
			text: part.text,
			unit: part.kind === 'reference' ? link(part.id) : null
		}));
	});
</script>

{#each parts as part, index (index)}{#if part.unit}<WorkspaceLink
			{workspace}
			to={part.unit.to}
			class="unit-reference"
			><Icon name={part.unit.category} size={13} />{part.unit.name}</WorkspaceLink
		>{:else}{part.text}{/if}{/each}

<style>
	:global(a.unit-reference) {
		color: var(--hx-color-primary);
		overflow-wrap: anywhere;
		text-decoration: underline;
		text-underline-offset: 2px;
	}
	:global(a.unit-reference svg) {
		margin-right: var(--hx-space-3);
		vertical-align: -2px;
	}
</style>
