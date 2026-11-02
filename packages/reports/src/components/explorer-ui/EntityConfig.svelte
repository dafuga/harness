<!-- @harness-tier organism -->
<!-- @harness-atoms ../shared-primitives/atoms -->
<!-- @harness-uid u_chzh7fstkr -->
<script lang="ts">
	import DetailList from '../shared-primitives/DetailList.svelte';
	import Card from './explorer-kit/Card.svelte';
	import type { ExplorerEntity, ExplorerScope } from '../../models/explorer-ui/Explorer.types';
	import { humanize } from '../../helpers/strings/humanize';
	import { entityLens, type EntityNav } from '../../utils/explorer-ui/entityLens';
	import { shortCommit } from '../../helpers/strings/shortCommit';
	import HarnessAction from './HarnessAction.svelte';
	let {
		entity,
		scope,
		nav
	}: {
		entity: ExplorerEntity;
		scope: ExplorerScope;
		nav: EntityNav;
	} = $props();
	let current = $derived(scope.mode === 'current');
	let commit = $derived(
		entityLens(nav.route, { category: 'configs', entity: entity.id, commit: scope.commit })
	);
	const word = (name: string) => humanize(name.slice(name.lastIndexOf('.') + 1));
	// A short declared type is part of the contract; a long one is a structure, not a setting.
	const kind = (type: string) => (type.length <= 48 ? type : 'structured value');
</script>

<Card
	as="section"
	tone="ex-evidence"
	labelledby="ex-config-title"
	component="harness-entity-config"
>
	<hx-header class="ex-evidence-head">
		<hx-div>
			<hx-h2 id="ex-config-title">{current ? 'Current configuration' : 'Configuration'}</hx-h2>
			<hx-p class="ex-soft">
				{current ? 'Current snapshot' : 'Values at'} · {shortCommit(scope.commit)}
			</hx-p>
		</hx-div>
		{#if current}
			<HarnessAction
				href={nav.href(commit)}
				onclick={() => nav.go(commit)}
				tone="plain"
				icon="arrow-right">View commit changes</HarnessAction
			>
		{/if}
	</hx-header>
	<hx-div class="ex-config">
		<hx-div>
			<hx-h3>Settings it provides</hx-h3>
			{#if entity.unit.contract.outputs.length === 0}
				<hx-p class="ex-soft">Its contract declares no setting at this revision.</hx-p>
			{/if}
			{#if entity.unit.contract.outputs.length}
				<DetailList
					rows={entity.unit.contract.outputs}
					rowKey={(_, position) => position}
					className="ex-rows"
				>
					{#snippet label(setting)}{word(setting.name)}{/snippet}
					{#snippet children(setting)}{kind(setting.type)}{/snippet}
				</DetailList>
			{/if}
		</hx-div>
	</hx-div>
	<hx-p class="ex-note">
		A config has no screenshot and no benchmark of its own; what it costs is measured on the
		entities that use it.
	</hx-p>
</Card>
