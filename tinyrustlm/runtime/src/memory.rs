//! WASM memory boundary helpers.

#![allow(unsafe_code)]

use crate::errors::ErrorCode;

const MAX_TRANSFER_BYTES: usize = 128 * 1024 * 1024;

/// Allocates a byte buffer in WASM linear memory and returns its pointer.
///
/// The caller must pass the returned pointer and the same capacity to
/// [`deallocate_bytes`] when the browser no longer needs the transfer buffer.
pub fn allocate_bytes(len: usize) -> *mut u8 {
    if len == 0 || len > MAX_TRANSFER_BYTES {
        return core::ptr::null_mut();
    }
    let mut bytes: Vec<u8> = Vec::with_capacity(len);
    let ptr = bytes.as_mut_ptr();
    core::mem::forget(bytes);
    ptr
}

/// Releases a buffer previously returned by [`allocate_bytes`].
///
/// `ptr` must be the original pointer and `len` must be the original capacity.
pub unsafe fn deallocate_bytes(ptr: *mut u8, len: usize) {
    if !ptr.is_null() && len > 0 && len <= MAX_TRANSFER_BYTES {
        let _ = Vec::from_raw_parts(ptr, 0, len);
    }
}

/// Validates a raw byte range and returns it as an immutable slice.
///
/// The caller must ensure the pointer is valid for `len` bytes for the duration
/// of the returned borrow.
pub unsafe fn slice_from_raw<'a>(ptr: *const u8, len: usize) -> Result<&'a [u8], ErrorCode> {
    if ptr.is_null() {
        return Err(ErrorCode::NullPointer);
    }
    if len == 0 || len > MAX_TRANSFER_BYTES {
        return Err(ErrorCode::InvalidLength);
    }
    Ok(core::slice::from_raw_parts(ptr, len))
}
