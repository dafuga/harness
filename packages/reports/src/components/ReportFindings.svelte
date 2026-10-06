<script lang="ts">
 import type {Finding} from '../models/Report.types';
 import {t} from '../utils/reportLocale';
 import StatusBadge from './StatusBadge.svelte';
 let {findings}: {findings:Finding[]}=$props();
</script>
{#if findings.length}
 <section class="findings" aria-labelledby="findings-title"><h2 id="findings-title">{$t('findings')}</h2>
  <div class="finding-grid">{#each findings as item (item.id)}
   <article class="panel" id={'finding-'+item.id}>
    <StatusBadge status={item.status}/><h3><a href={'#finding-'+item.id}>{item.title}</a></h3><p>{item.detail}</p>
    <div class="toolbar">{#each item.evidenceIds||[] as id}<a class="text-link" href={'#evidence-'+id}>{$t('evidence')} {id} ↗</a>{/each}</div>
   </article>
  {/each}</div>
 </section>
{/if}
