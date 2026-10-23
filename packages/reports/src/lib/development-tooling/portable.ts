import type {} from './portable.types';
import { mount } from 'svelte';
import ReportView from '../../components/reports-media/ReportView.svelte';
import '../styles/base.css';
import '../styles/base-2.css';
import '../styles/base-3.css';
import '../styles/gallery.css';
import '../styles/gallery-2.css';
mount(ReportView, {
	target: document.getElementById('app')!,
	props: {
		report: window.projectReport,
		assetBase: '',
		downloadBase: '',
		portable: true
	}
});
