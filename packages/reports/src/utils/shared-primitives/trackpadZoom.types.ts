// @harness-uid u_rptchqt5ts
export type ZoomPoint = { x: number; y: number };

export type ZoomControls = {
	current: number;
	minimum: number;
	maximum: number;
	apply: (next: number | null, point: ZoomPoint) => void;
};

export type Gesture = Event & { scale?: number; clientX?: number; clientY?: number };
