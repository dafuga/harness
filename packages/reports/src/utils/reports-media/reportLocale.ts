import { addMessages, init } from 'svelte-i18n';
import english from './report-locale/en.json' with { type: 'json' };
import french from './report-locale/fr.json' with { type: 'json' };
export { _ as t } from 'svelte-i18n';
addMessages('en', english);
addMessages('fr', french);
void init({ fallbackLocale: 'en', initialLocale: 'en' });
export function reportLocale() {
	return 'en';
}
