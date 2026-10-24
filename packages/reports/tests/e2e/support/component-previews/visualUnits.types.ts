/** A unit manifest, as far as choosing and mounting its preview reads it. */
export interface PreviewManifest {
	id: string;
	title: string;
	kind: string;
	status: string;
	owns: { source: string[]; symbols: string[] };
	runtime: { entry: string };
	catalog?: { visibility: 'public' | 'internal' };
	composition?: { level: string; element?: string };
}
