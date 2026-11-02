import { appStyleTokensConfig } from '../../configs/shared-primitives/appStyleTokensConfig';
import type { StyleToken } from './ExplorerStylesScreen.types';
import { groupFor } from './styleTokenGroups';

/** Only :root rules publish app tokens; a component stylesheet's own variables are not listed. */
function readRules(rules: CSSRuleList, found: Map<string, string>) {
	for (const rule of Array.from(rules)) {
		if (rule instanceof CSSStyleRule && rule.selectorText === ':root') {
			readStyle(rule.style, found);
		} else if (rule instanceof CSSImportRule && rule.styleSheet) {
			readSheet(rule.styleSheet, found);
		} else if ('cssRules' in rule) {
			readRules((rule as CSSGroupingRule).cssRules, found);
		}
	}
}

function readSheet(sheet: CSSStyleSheet, found: Map<string, string>) {
	try {
		readRules(sheet.cssRules, found);
	} catch {
		// A cross-origin stylesheet cannot expose its rules to this page.
	}
}

function readStyle(style: CSSStyleDeclaration, found: Map<string, string>) {
	for (let index = 0; index < style.length; index += 1) {
		const name = style.item(index);
		if (appStyleTokensConfig.legacyAliases.test(name)) continue;
		if (name.startsWith('--hx-') && !found.has(name))
			found.set(name, style.getPropertyValue(name).replace(/\s+/g, ' ').trim());
	}
}
/** The tokens in the order the token source declares them, with what each one resolves to. */
export function discoverTokens(): StyleToken[] {
	const found = new Map<string, string>();
	for (const sheet of Array.from(document.styleSheets)) readSheet(sheet, found);
	const root = getComputedStyle(document.documentElement);
	return [...found].map(([name, value]) => {
		const resolved = root.getPropertyValue(name).replace(/\s+/g, ' ').trim() || value;
		return { name, value, resolved, group: groupFor(name) };
	});
}
