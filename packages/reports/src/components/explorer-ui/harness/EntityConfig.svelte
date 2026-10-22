<script lang="ts">
	import type { ExplorerEntity, ExplorerScope } from '../../../models/explorer-ui/Explorer.types';
	import { humanize } from '../../../utils/explorer-ui/entityContract';
	import { entityLens, shortCommit, type EntityNav } from '../../../utils/explorer-ui/entityLens';
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

<section class="ex-card ex-evidence" aria-labelledby="ex-config-title">
	<header class="ex-evidence-head">
		<div>
			<h2 id="ex-config-title">{current ? 'Current configuration' : 'Configuration'}</h2>
			<p class="ex-soft">
				{current ? 'Current snapshot' : 'Values at'} · {shortCommit(scope.commit)}
			</p>
		</div>
		{#if current}
			<HarnessAction
				href={nav.href(commit)}
				onclick={() => nav.go(commit)}
				tone="plain"
				icon="arrow-right">View commit changes</HarnessAction
			>
		{/if}
	</header>
	<div class="ex-config">
		<div>
			<h3>Settings it provides</h3>
			{#if entity.unit.contract.outputs.length === 0}
				<p class="ex-soft">Its contract declares no setting at this revision.</p>
			{/if}
			<dl class="ex-rows">
				{#each entity.unit.contract.outputs as setting, position (position)}
					<div>
						<dt>{word(setting.name)}</dt>
						<dd>{kind(setting.type)}</dd>
					</div>
				{/each}
			</dl>
		</div>
	</div>
	<p class="ex-note">
		A config has no screenshot and no benchmark of its own; what it costs is measured on the
		entities that use it.
	</p>
</section>
