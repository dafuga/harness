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
	id: string;
}

interface DockerLaunchIdentity {
	owner: string;
	cwd: string;
	host: string;
	daemonId: string;
	pid: number;
	startedAt: string;
	containerId?: string;
}

export interface DockerBindLaunch extends DockerLaunchIdentity {
	version: 1;
}

export interface DockerVolumeLaunch extends DockerLaunchIdentity {
	version: 2;
	stage: 'volume' | 'storage' | 'task';
	storageId?: string;
}

export type DockerTaskLaunch = DockerBindLaunch | DockerVolumeLaunch;

export interface DockerVolumeResources {
	volume: boolean;
	storage?: string;
	task?: string;
}
