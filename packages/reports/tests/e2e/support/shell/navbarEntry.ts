import { mount } from 'svelte';
import '../../../../src/lib/styles/base.css';
import '../../../../src/lib/styles/base-2.css';
import '../../../../src/lib/styles/base-3.css';
import '../../../../src/lib/styles/gallery.css';
import '../../../../src/lib/styles/gallery-2.css';
import '../../../../src/lib/styles/harness.css';
import ShellNavbar from './ShellNavbar.svelte';

// The same stylesheets, in the same order, as the console that is installed in a host.
mount(ShellNavbar, { target: document.getElementById('app') as HTMLElement });
