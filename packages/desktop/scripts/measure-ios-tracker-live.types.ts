// @harness-uid u_6cqqnlqxpd
/** What the measurement uses of the Hub's workerd fixture. */
export interface HubFixture {
	origin: string;
	stop(): Promise<void>;
}

export type HubStart = (options: { entry: string; migrations: string[] }) => Promise<HubFixture>;
