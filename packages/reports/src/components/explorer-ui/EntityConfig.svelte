<!-- @harness-tier organism -->
<!-- @harness-atoms ../shared-primitives/atoms -->
<script lang="ts">
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

<hx-section
	class="ex-card ex-evidence"
	aria-labelledby="ex-config-title"
	data-harness-component="harness-entity-config"
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
			<hx-dl class="ex-rows">
				{#each entity.unit.contract.outputs as setting, position (position)}
					<hx-div>
						<hx-dt>{word(setting.name)}</hx-dt>
						<hx-dd>{kind(setting.type)}</hx-dd>
					</hx-div>
				{/each}
			</hx-dl>
		</hx-div>
	</hx-div>
	<hx-p class="ex-note">
		A config has no screenshot and no benchmark of its own; what it costs is measured on the
		entities that use it.
	</hx-p>
</hx-section>
