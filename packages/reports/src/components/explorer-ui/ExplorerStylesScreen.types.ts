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
	group: StyleGroupName | UnclassifiedGroupName;
}

export interface StyleTokenGroup {
	name: StyleGroupName | UnclassifiedGroupName;
	description: string;
	tokens: StyleToken[];
}
