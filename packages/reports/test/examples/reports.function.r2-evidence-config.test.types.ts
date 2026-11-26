export type R2Settings = {
	accountId: string;
	bucket: string;
	accessKeyId: string;
	secretAccessKey: string;
	endpoint: string;
};

export type Env = Record<string, string | undefined>;
