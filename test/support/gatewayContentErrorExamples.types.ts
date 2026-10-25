/** Authored markers for values JSON cannot carry; each names the value its example rebuilds. */
export type GatewayContentErrorFixture =
	| { $fixture: 'undefined' }
	| { $fixture: 'symbol'; description: string }
	| { $fixture: 'bigint'; value: string }
	| { $fixture: 'null-prototype' }
	| { $fixture: 'text-object'; text: string };

/** The name and message an Example displays in place of the Error object the function returns. */
export interface GatewayContentErrorProjection {
	name: string;
	message: string;
}
