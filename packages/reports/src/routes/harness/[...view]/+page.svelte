<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import '../../../lib/styles/harness.css';
	import HarnessConsole from '../../../components/harness/HarnessConsole.svelte';
	const base = '/harness';
	const links = [
		{ label: 'Reports', href: '/harness/reports' },
		{ label: 'Analytics', href: '/harness/analytics' }
	];
	// Each branch, commit and view is a path of this route, so the router keeps its history.
	const navigate = (path: string, replace: boolean) =>
		goto(base + path, { replaceState: replace, noScroll: true, keepFocus: true });
</script>

<svelte:head><title>Harness</title></svelte:head>
<HarnessConsole {base} path={page.url.pathname.slice(base.length)} {navigate} {links} />
