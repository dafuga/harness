import { mount } from 'svelte';
import '../../../../src/lib/styles/base.css';
import '../../../../src/lib/styles/gallery.css';
import '../../../../src/lib/styles/project-overview.css';
import '../../../../src/lib/styles/project-overview-cards.css';
import '../../../../src/lib/styles/project-overview-controls.css';
import '../../../../src/lib/styles/home-scheme.css';
import '../../../../src/lib/styles/hub-home/index.css';
import ShellOutgoingDrafts from './ShellOutgoingDrafts.svelte';

mount(ShellOutgoingDrafts, { target: document.getElementById('app') as HTMLElement });
