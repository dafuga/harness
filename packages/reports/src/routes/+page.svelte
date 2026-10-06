<script lang="ts">
 import {onMount} from 'svelte';
 import HubView from '../components/HubView.svelte';
 import type {Report} from '../models/Report.types';
 import {t} from '../utils/reportLocale';
 let {data}: {data:{reports:Report[]}}=$props();
 let reports=$state<Report[]>([]),error=$state(false);
 $effect(()=>{reports=data.reports;});
 onMount(()=>{ const timer=setInterval(()=>{void refresh();},2000);return ()=>clearInterval(timer); });
 async function refresh(){try{const res=await fetch('/api/reports');if(!res.ok)throw new Error();reports=await res.json();error=false;}catch{error=true;}}
</script>
<svelte:head><title>Project reports</title></svelte:head>
{#if error}<p class="notice" role="status">{$t('refreshError')}</p>{/if}
<HubView {reports}/>
