import { addMessages } from 'svelte-i18n';
import english from './translations/en.json' with { type: 'json' };
import french from './translations/fr.json' with { type: 'json' };
let registered = false;
/** Register the replay dictionaries once alongside the report strings. */
export function replayLocale() {
	if (registered) return;
	registered = true;
	addMessages('en', english);
	addMessages('fr', french);
}
