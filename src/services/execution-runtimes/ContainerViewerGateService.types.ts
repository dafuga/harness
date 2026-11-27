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
}
