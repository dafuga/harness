// @harness-uid u_q6vu4wcrvc
/** Colour family of a strip entry; the component maps it to a `data-tone` value. */
export type StripTone = 'done' | 'active' | 'warn' | 'blocked';

/** The state word that follows a computer's load, as the strip shows it. */
export type StripComputerState = 'Healthy' | 'Busy' | 'High load' | 'Offline';

/** One computer in the stats strip: a name, a state word, a load bar and one line of detail. */
export interface StripComputer {
	name: string;
	tone: StripTone;
	state: StripComputerState;
	/** CPU load in whole percent, 0 to 100; null when it is unknown or the computer is offline. */
	load: number | null;
	/** Desktop line under the bar, such as "4 sessions · 62% load". */
	sub: string;
	/** iPhone chip line, such as "62% load", "Load unknown" or "Offline". */
	short: string;
}
