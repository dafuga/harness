// @harness-uid u_ymrcybx25k

export interface DockerTaskWorkspace {
	cwd: string;
	image: string;
	signal: AbortSignal;
}

export interface DockerTaskCreate {
	cwd: string;
	image: string;
	owner: string;
	user: string;
}

export interface DockerTaskDaemon {
	env: Record<string, string | undefined>;
	host: string;
}
