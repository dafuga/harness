// @harness-uid u_z3okqfjr2m
import type { ContainerBrowserPipes } from '../../core/execution-runtimes/containerBrowser.types';
import type { ViewerDeviceRepository } from '../../repositories/execution-runtimes/ViewerDeviceRepository';

export interface ContainerViewerGateConfig {
	pipes: ContainerBrowserPipes;
	devices: ViewerDeviceRepository;
	/** Directory holding the noVNC client. */
	assets: string;
	/** Host names and addresses the viewer is opened by. */
	hosts: readonly string[];
	remote?: {
		host: string;
		devices: ViewerDeviceRepository;
		authorize: (assertion: string) => Promise<number | undefined>;
	};
}

export interface ViewerAdmission {
	devices: ViewerDeviceRepository;
	origin: string;
	expiresAt?: number;
}

export interface ViewerConnection extends ViewerAdmission {
	token: string;
}
