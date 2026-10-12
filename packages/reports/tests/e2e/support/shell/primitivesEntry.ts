import { mount } from 'svelte';
import '../../../../src/lib/styles/base.css';
import '../../../../src/lib/styles/base-2.css';
import '../../../../src/lib/styles/base-3.css';
import '../../../../src/lib/styles/gallery.css';
import '../../../../src/lib/styles/gallery-2.css';
import '../../../../src/lib/styles/harness.css';
import ShellPrimitives from './ShellPrimitives.svelte';

mount(ShellPrimitives, { target: document.getElementById('app') as HTMLElement });
