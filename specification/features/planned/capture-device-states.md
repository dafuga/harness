# Capture device states

Retained screenshots must use one logical state across desktop, tablet and mobile.
A device switch selects that state's actual image at the selected revision; it never
borrows another module's pixels, another revision or an unrelated state.

The component preview emitter currently includes the viewport in its state name.
The viewer preserves that desktop-specific state while switching devices, so it
shows a missing capture despite retained tablet and mobile images.

Acceptance:

- The existing capture protocol test emits all three devices under one state and retains three distinct image files plus scoped measurements.
- The existing screenshot viewer matrix switches through retained legacy device-qualified states and decodes the correct image at each device.
- Original capture state, hash, source revision and focused outcome remain unchanged in provenance.
- Missing devices, unrelated states, other units and different source trees remain honest gaps.
- Standard unit and browser coverage rejects reintroducing the mismatch.

Full CLI and native suites remain deferred. Main landing follows the coordinator's queue.
