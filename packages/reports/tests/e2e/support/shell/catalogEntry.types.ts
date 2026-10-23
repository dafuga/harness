declare global {
	interface Window {
		previewDocument: Readonly<{ unit: string; timeOrigin: number }>;
		previewRemount: () => Promise<void>;
	}
}
export {};
