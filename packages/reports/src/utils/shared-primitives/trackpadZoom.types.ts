export type Point = { x: number; y: number };

export type ZoomControls = {
	current: number;
	minimum: number;
	maximum: number;
	apply: (next: number | null, point: Point) => void;
};

export type Gesture = Event & { scale?: number; clientX?: number; clientY?: number };
