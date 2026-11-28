import type {
	SealedChainPin,
	SealedDeviceKeys
} from '../../../../../remote/src/models/networking-security/Sealed.types';
import type { EnrollmentProgress } from '../../../../../remote/src/services/networking-security/SealedEnrollmentRequestService.types';

export interface BrowserEnrollment {
	device: SealedDeviceKeys;
	progress: EnrollmentProgress;
}

export interface BrowserEnrollmentRecord {
	installation?: BrowserEnrollment;
	accountPin?: SealedChainPin;
}
