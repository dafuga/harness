export interface ApnsSigningKey {
	team: string;
	id: string;
	pem: string;
}

export interface ApnsProviderToken {
	team: string;
	id: string;
	window: number;
	value: Promise<string>;
}
