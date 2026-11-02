// @harness-uid u_6xzgnnbmg3
import { appStyleTokensConfig } from '../../configs/shared-primitives/appStyleTokensConfig';
import type {
	StyleGroupName,
	StyleRole,
	StyleRoleCard,
	StyleSpecimen,
	StyleToken,
	StyleTokenGroup,
	UnclassifiedGroupName
} from './ExplorerStylesScreen.types';

export const unclassified: UnclassifiedGroupName = 'Unclassified tokens';
const { groupPrefixes: prefixes, groupDescriptions: descriptions } = appStyleTokensConfig;
export const roles: Partial<Record<string, readonly StyleRole[]>> = appStyleTokensConfig.roles;

/** How a token is drawn, by the first prefix it matches; `$` stands for its own reference. */
export const drawings: [RegExp, StyleSpecimen, string][] = [
	[/^--hx-color-/, 'swatch', '--style-specimen: $'],
	[/^--hx-font-family-/, 'text', 'font-family: $'],
	[/^--hx-type-size-/, 'text', 'font-size: $'],
	[/^--hx-style-weight-/, 'text', 'font-weight: $'],
	[/^--hx-style-font-/, 'text', 'font-style: $'],
	[/^--hx-style-leading-/, 'text', 'line-height: $'],
	[/^--hx-style-tracking-/, 'text', 'letter-spacing: $'],
	[/^--hx-style-numeric-/, 'text', 'font-variant-numeric: $'],
	[/^--hx-style-synthesis-/, 'text', 'font-synthesis: $'],
	[/^--hx-style-/, 'text', 'font: $'],
	[/^--hx-(?:space-|gutter$|nav-|layout-)/, 'bar', 'inline-size: $'],
	[/^--hx-border-/, 'edge', 'border-block-start: $ solid'],
	[/^--hx-radius/, 'corner', 'border-radius: $'],
	[/^--hx-shadow-/, 'shadow', 'box-shadow: $'],
	[/^--hx-effect-/, 'fade', 'filter: $'],
	[/^--hx-opacity-/, 'fade', 'opacity: $'],
	[/^--hx-breakpoint-/, 'bar', 'inline-size: calc($ / 6)'],
	[/^--hx-/, 'value', '']
];

export function groupFor(name: string): StyleGroupName | UnclassifiedGroupName {
	return appStyleTokensConfig.groups.find((group) => prefixes[group].test(name)) ?? unclassified;
}

export function groupTokens(list: StyleToken[]): StyleTokenGroup[] {
	const declared = appStyleTokensConfig.groups.map((name) => ({
		name,
		description: descriptions[name],
		tokens: list.filter((token) => token.group === name)
	}));
	const rest = list.filter((token) => token.group === unclassified);
	if (!rest.length) return declared;
	const description = 'Shared tokens whose prefix no group above claims.';
	return [...declared, { name: unclassified, description, tokens: rest }];
}

/** Each token once, under the first role that names it; a token no role names is still shown. */
export function assignRoles(group: StyleTokenGroup): StyleRoleCard[] {
	const left = new Set(group.tokens);
	const claim = (name: string) => [...left].filter((t) => t.name === name && left.delete(t));
	const sets = (base: StyleToken[], rows: StyleToken[]) =>
		[
			{ label: group.name === 'Colors' ? 'Base color' : 'Variable', base: true, rows: base },
			{ label: base.length ? 'Treatments' : 'Variables', base: false, rows }
		].filter((set) => set.rows.length);
	const cards = (roles[group.name] ?? []).map(({ base, tokens: treatments = [], ...role }) => ({
		...role,
		sets: sets(base ? claim(base) : [], treatments.flatMap(claim))
	}));
	const rest = sets([], [...left.values()]);
	return rest.length ? [...cards, { ...appStyleTokensConfig.unassigned, sets: rest }] : cards;
}

/** Two lines of numerals show leading and numeral styles; any other text style draws letters. */
export const sample = (name: string) =>
	/^--hx-style-(?:leading|numeric)-/.test(name) ? '1111 8888\n0123 4567' : 'Aa Bb 0123';

export const headingId = (name: string) =>
	`styles-group-${name.toLowerCase().replace(/\W+/g, '-')}`;
