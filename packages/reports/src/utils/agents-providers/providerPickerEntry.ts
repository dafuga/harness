import { mount } from 'svelte';
import ProviderPicker from '../../components/agents-providers/provider-picker/ProviderPicker.svelte';
import '../../lib/styles/base.css';

export function providerPickerEntry() {
	return mount(ProviderPicker, { target: document.getElementById('app')! });
}

providerPickerEntry();
