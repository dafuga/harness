import { mount } from 'svelte';
import ProviderPicker from '../components/ProviderPicker.svelte';
import '../lib/styles/base.css';

export function providerPickerEntry() {
	return mount(ProviderPicker, { target: document.getElementById('app')! });
}

providerPickerEntry();
