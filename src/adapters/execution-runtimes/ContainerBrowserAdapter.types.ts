// @harness-uid u_7uvhgmunfw
import type { Duplex } from 'node:stream';

export interface ContainerBrowserConfig {
	/** Names the container and its saved browser profile, so each site keeps its own sign-in. */
	profile: string;
	screen?: string;
}

export interface DockerEndpoint {
	/** The engine's Unix socket. */
	socket: string;
	/** A Docker config directory holding no credentials. */
	config: string;
}

export interface ContainerBrowserHost {
	docker(args: readonly string[], timeoutMs?: number): Promise<string>;
	stream(args: readonly string[]): Duplex;
}
