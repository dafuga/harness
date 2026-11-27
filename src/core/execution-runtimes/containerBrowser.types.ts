// @harness-uid u_plxy3uehkc
import type { Duplex } from 'node:stream';

/** The two services a container browser keeps on its own loopback. */
export type ContainerBrowserPort = 'screen' | 'devtools';

export interface ContainerBrowserStatus {
	container: string;
	running: boolean;
	image?: string;
}

/** Opens one private byte stream into the running browser container. */
export interface ContainerBrowserPipes {
	pipe(port: ContainerBrowserPort): Duplex;
}
