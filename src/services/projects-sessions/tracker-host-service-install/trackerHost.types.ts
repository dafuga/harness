// @harness-uid u_s4ahu5mjk4
import type {
	TrackerHostFile,
	TrackerHostInstallInput,
	TrackerHostInstallPorts
} from '../TrackerHostInstallService.types';

export interface TrackerHost {
	files(input: TrackerHostInstallInput, ports: TrackerHostInstallPorts): TrackerHostFile[];
	install(input: TrackerHostInstallInput, ports: TrackerHostInstallPorts): string[];
	uninstall(input: TrackerHostInstallInput, ports: TrackerHostInstallPorts): string[];
}
