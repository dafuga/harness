<!-- @harness-tier organism -->
<!-- @harness-atoms ../shared-primitives/atoms -->
<script lang="ts">
	import type { Finding } from '../../models/reports-media/Report.types';
	import { t } from '../../utils/reports-media/reportLocale';
	import StatusBadge from '../shared-primitives/StatusBadge.svelte';
	let { findings }: { findings: Finding[] } = $props();
</script>

{#if findings.length}
	<hx-section class="findings" aria-labelledby="findings-title"
		><hx-h2 id="findings-title">{$t('findings')}</hx-h2>
		<hx-div class="finding-grid"
			>{#each findings as item (item.id)}
				<hx-article class="panel" id={'finding-' + item.id}>
					<StatusBadge status={item.status} /><hx-h3
						><hx-a href={'#finding-' + item.id}>{item.title}</hx-a></hx-h3
					><hx-p>{item.detail}</hx-p>
					<hx-div class="toolbar"
						>{#each item.evidenceIds || [] as id}<hx-a class="text-link" href={'#evidence-' + id}
								>{$t('evidence')} {id} ↗</hx-a
							>{/each}</hx-div
					>
				</hx-article>
			{/each}</hx-div
		>
	</hx-section>
{/if}
