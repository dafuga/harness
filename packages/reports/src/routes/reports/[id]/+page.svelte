<script lang="ts">
 import {onMount} from 'svelte';
 import ReportView from '../../../components/ReportView.svelte';
 import type {Report} from '../../../models/Report.types';
 import {t} from '../../../utils/reportLocale';
 let {data}: {data:{report:Report}}=$props();
 let fetchedReport=$state<Report|null>(null),error=$state(false);
 let report=$derived(fetchedReport?.id===data.report.id?fetchedReport:data.report);
 onMount(()=>{ const timer=setInterval(()=>{if(report.state!=='finalized')void refresh();},2000);return ()=>clearInterval(timer); });
 async function refresh(){try{const res=await fetch('/api/reports/'+report.id);if(!res.ok)throw new Error();fetchedReport=await res.json();error=false;}catch{error=true;}}
</script>
<svelte:head><title>{report.title} · Project reports</title></svelte:head>
{#if error}<p class="notice" role="status">{$t('refreshError')}</p>{/if}
<ReportView {report} assetBase={'/api/reports/'+report.id+'/assets/'} downloadBase={'/api/reports/'+report.id+'/exports/'} onUploaded={(updated)=>{fetchedReport=updated;}}/>
