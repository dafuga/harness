export type UploadPost = (event: { request: Request; url: URL }) => Promise<Response>;
export interface AdmissionCase {
	headers: Record<string, string>;
	status: number;
	error: string;
	reads: number;
}
