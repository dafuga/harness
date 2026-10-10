//! Harness JSON ABI for core WebAssembly: allocate, invoke, free.
//!
//! The host copies a UTF-8 request into memory from `harness_alloc`, calls `harness_invoke`,
//! reads the response at the returned pointer and length, then frees both buffers.

use std::alloc::{alloc, dealloc, Layout};

fn layout(len: usize) -> Layout {
    Layout::from_size_align(len.max(1), 1).expect("a byte layout is always valid")
}

/// Allocates `len` bytes for the host to fill. Returns null when memory is exhausted.
#[no_mangle]
pub extern "C" fn harness_alloc(len: usize) -> *mut u8 {
    // SAFETY: the layout has a non-zero size and byte alignment.
    unsafe { alloc(layout(len)) }
}

/// Frees a buffer from `harness_alloc` or `harness_invoke`.
///
/// # Safety
/// `ptr` must come from one of those functions with the same `len` and be freed only once.
#[no_mangle]
pub unsafe extern "C" fn harness_free(ptr: *mut u8, len: usize) {
    if !ptr.is_null() {
        // SAFETY: the caller guarantees the pointer and length match the allocation.
        unsafe { dealloc(ptr, layout(len)) }
    }
}

/// Handles the request at `ptr` and returns `(pointer << 32) | length` of the response.
///
/// # Safety
/// `ptr` must address `len` readable bytes.
#[no_mangle]
pub unsafe extern "C" fn harness_invoke(ptr: *const u8, len: usize) -> u64 {
    // SAFETY: the caller guarantees `ptr` addresses `len` readable bytes.
    let bytes = unsafe { std::slice::from_raw_parts(ptr, len) };
    let response = crate::handle(std::str::from_utf8(bytes).unwrap_or(""));
    let target = harness_alloc(response.len());
    if target.is_null() {
        return 0;
    }
    // SAFETY: `target` was just allocated with room for the whole response.
    unsafe { std::ptr::copy_nonoverlapping(response.as_ptr(), target, response.len()) };
    ((target as usize as u64) << 32) | response.len() as u64
}
