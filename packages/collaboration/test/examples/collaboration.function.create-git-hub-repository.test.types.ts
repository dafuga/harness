export type FakeResponseInput = {
	method: string;
	endpoint: string;
	body: BodyInit | null | undefined;
	repositoryId: number;
	ref: string;
	branch: { sha: string | null };
};
