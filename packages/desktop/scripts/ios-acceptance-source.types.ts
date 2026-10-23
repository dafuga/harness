/** The three sets a run is made from, as they are read at one moment. */
export interface SourceReading {
	renderer: Map<string, string>;
	native: Map<string, string>;
	fixtureComputer: Map<string, string>;
}
