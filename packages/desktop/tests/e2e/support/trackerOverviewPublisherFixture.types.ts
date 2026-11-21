/** One request the Hub spy received from the real publisher wire. */
export type HubSpyRecord = {
	method: string;
	path: string;
	bearer: string | null;
	body: string;
};

export type HubSpy = {
	origin: string;
	records: HubSpyRecord[];
	close(): Promise<void>;
};
