<script lang="ts">
	import type { EntityContract } from '../models/Desktop.types';
	let { contract }: { contract: EntityContract } = $props();
</script>

<section class="panel">
	<h2>Contract</h2>
	{#each ['inputs', 'outputs', 'errors'] as group (group)}<h3>
			{group[0].toUpperCase() + group.slice(1)}
		</h3>
		{#each contract[group as 'inputs' | 'outputs' | 'errors'] as field (field.name)}<div
				class="contract-field"
			>
				<strong>{field.name}</strong><code>{field.type}</code>
			</div>{:else}<p class="muted">Not recorded</p>{/each}{/each}
</section>
