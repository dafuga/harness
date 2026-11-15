// @harness-uid u_nfctcgnv7g
export interface VideoOwner {
	id: string;
	status: string;
	owns: { source: string[] };
	dependencies: { unit: string }[];
}
