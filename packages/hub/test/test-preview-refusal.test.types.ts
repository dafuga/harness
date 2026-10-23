export interface Preview {
	webServer: { command: string; url: string; reuseExistingServer: boolean };
	use: { baseURL: string };
}
