import type {} from './console.types';
import { mount } from 'svelte';
import ConsoleShell from '../../components/explorer-ui/HarnessShell.svelte';
import '../styles/base.css';
import '../styles/base-2.css';
import '../styles/base-3.css';
import '../styles/gallery.css';
import '../styles/gallery-2.css';
import '../styles/harness.css';

// The document that carries this script says where its protected endpoints are.
mount(ConsoleShell, {
	target: document.getElementById('app') as HTMLElement,
	props: window.harnessConsole ?? { base: '/harness' }
});
