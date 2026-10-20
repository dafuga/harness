import { mount } from 'svelte';
import ActivityListStates from './ActivityListStates.svelte';
import '../../../../src/lib/styles/base.css';
import '../../../../src/lib/styles/analytics.css';
import '../../../../src/lib/styles/harness.css';

document.body.classList.add('hx-shell');
mount(ActivityListStates, {
	target: document.getElementById('app')!,
	props: { state: new URLSearchParams(location.search).get('state') ?? 'collapsed' }
});
