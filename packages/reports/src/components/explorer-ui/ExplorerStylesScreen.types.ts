import type { appStyleTokensConfig } from '../../configs/shared-primitives/appStyleTokensConfig';

/** A catalog group declared by the shared app style token config. */
export type StyleGroupName = (typeof appStyleTokensConfig.groups)[number];

/** Where a token whose prefix no declared group claims is listed, rather than among the colors. */
export type UnclassifiedGroupName = 'Unclassified tokens';

/** How a token is drawn: a swatch, sample text, a measure, an edge, a corner, a raised surface,
 *  a faded block, or only its value when no drawing would show it. */
export type StyleSpecimen =
	| 'swatch'
	| 'text'
	| 'bar'
	| 'edge'
	| 'corner'
	| 'shadow'
	| 'fade'
	| 'value';

/** One custom property declared in the global token source. */
export interface StyleToken {
	name: string;
	/** As declared, whitespace collapsed; a derived token keeps the references it mixes. */
	value: string;
	/** What this browser resolves it to, with every reference it makes substituted. */
	resolved: string;
	group: StyleGroupName | UnclassifiedGroupName;
}

export interface StyleTokenGroup {
	name: StyleGroupName | UnclassifiedGroupName;
	description: string;
	tokens: StyleToken[];
}

/** A purpose-named choice as the config declares it: what it is for, its one variable, where the
 *  apps read it, and the subordinate treatments mixed from it. */
export interface StyleRole {
	name: string;
	use?: string;
	where?: string;
	base?: string;
	tokens?: readonly string[];
}

/** A role drawn on Styles: its base variable, then the treatments subordinate to it. */
export interface StyleRoleCard {
	name: string;
	use?: string;
	where?: string;
	sets: { label: string; base: boolean; rows: StyleToken[] }[];
}
