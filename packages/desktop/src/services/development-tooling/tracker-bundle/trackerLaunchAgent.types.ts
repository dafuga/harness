// @harness-uid u_tbh9u4wcfi
export interface NewAgent {
	agent: string;
	executable: string;
	config: string;
	role: 'hub' | 'spoke';
	home: string;
	logs: string;
}
