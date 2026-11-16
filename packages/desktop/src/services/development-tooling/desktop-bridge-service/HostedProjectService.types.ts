// @harness-uid u_h3qimurn22
import type { DesktopBridge } from '../../../models/development-tooling/DesktopBridge.types';

export class HostedProjectBusyError extends Error {
	override name = 'HostedProjectBusyError';
}

export class HostedProjectNotSelectedError extends Error {
	override name = 'HostedProjectNotSelectedError';
}

export class HostedProjectExecutorUnavailableError extends Error {
	override name = 'HostedProjectExecutorUnavailableError';
}

export class HostedProjectEvidenceUnavailableError extends Error {
	override name = 'HostedProjectEvidenceUnavailableError';
}

export class HostedProjectOperationUnsupportedError extends Error {
	override name = 'HostedProjectOperationUnsupportedError';
}

export class HostedProjectReadUnavailableError extends Error {
	override name = 'HostedProjectReadUnavailableError';
}

export type Bridge = Omit<DesktopBridge, 'onRunEvent'>;

export type HostedInput = Record<string, unknown> & { projectId: string };
