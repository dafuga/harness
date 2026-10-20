export interface HostRequest {
	host: string;
	policy: string;
	policyExport: string;
	base: string;
	update?: boolean;
	keep?: boolean;
	bucket?: string;
	prefix?: string;
}

export {
	installableHost,
	hostWarnings
} from '../cli/program/console-install-service/installableHost';
