//! Raw WebAssembly exports for handwritten JavaScript.

#![allow(unsafe_code)]

use crate::errors::ErrorCode;
use crate::generate::Runtime;
use crate::memory::{allocate_bytes, deallocate_bytes, slice_from_raw};
use std::sync::Mutex;

static RUNTIME: Mutex<Option<Runtime>> = Mutex::new(None);

/// Allocates `len` bytes in WASM linear memory.
#[no_mangle]
pub extern "C" fn alloc(len: usize) -> *mut u8 {
    allocate_bytes(len)
}

/// Releases a buffer previously returned by [`alloc`].
#[no_mangle]
pub unsafe extern "C" fn dealloc(ptr: *mut u8, len: usize) {
    deallocate_bytes(ptr, len);
}

/// Initializes runtime state.
#[no_mangle]
pub extern "C" fn init_runtime() -> u32 {
    match RUNTIME.lock() {
        Ok(mut runtime) => {
            *runtime = Some(Runtime::new());
            ErrorCode::Ok.as_u32()
        }
        Err(_) => ErrorCode::GenerationFailed.as_u32(),
    }
}

/// Loads a model from bytes already copied into WASM memory.
#[no_mangle]
pub unsafe extern "C" fn load_model(ptr: *const u8, len: usize) -> u32 {
    let bytes = match slice_from_raw(ptr, len) {
        Ok(bytes) => bytes,
        Err(error) => return set_error(error),
    };
    with_runtime_mut(|runtime| runtime.load_model(bytes))
}

/// Generates text from a UTF-8 prompt copied into WASM memory.
#[no_mangle]
pub unsafe extern "C" fn generate(ptr: *const u8, len: usize, max_new_tokens: u32) -> u32 {
    let bytes = match slice_from_raw(ptr, len) {
        Ok(bytes) => bytes,
        Err(error) => return set_error(error),
    };
    let prompt = match core::str::from_utf8(bytes) {
        Ok(prompt) => prompt,
        Err(_) => return set_error(ErrorCode::InvalidUtf8),
    };
    with_runtime_mut(|runtime| runtime.generate(prompt, max_new_tokens))
}

/// Configures decoding with temperature, top-k, top-p, and a deterministic seed.
#[no_mangle]
pub extern "C" fn set_sampling_config(temperature: f32, top_k: u32, top_p: f32, seed: u32) -> u32 {
    with_runtime_mut(|runtime| runtime.configure_sampling(temperature, top_k, top_p, seed))
}

/// Generates a single token and writes its decoded text to the last-result buffer.
#[no_mangle]
pub extern "C" fn generate_next_token() -> u32 {
    with_runtime_mut(|runtime| runtime.generate_next_token())
}

/// Returns a pointer to the last result bytes.
#[no_mangle]
pub extern "C" fn last_result_ptr() -> *const u8 {
    match RUNTIME.lock() {
        Ok(guard) => guard
            .as_ref()
            .map(|runtime| runtime.last_result().as_ptr())
            .unwrap_or(core::ptr::null()),
        Err(_) => core::ptr::null(),
    }
}

/// Returns the byte length of the last result.
#[no_mangle]
pub extern "C" fn last_result_len() -> usize {
    match RUNTIME.lock() {
        Ok(guard) => guard
            .as_ref()
            .map(|runtime| runtime.last_result().len())
            .unwrap_or(0),
        Err(_) => 0,
    }
}

/// Returns a pointer to diagnostics bytes.
#[no_mangle]
pub extern "C" fn get_diagnostics_ptr() -> *const u8 {
    match RUNTIME.lock() {
        Ok(guard) => guard
            .as_ref()
            .map(|runtime| runtime.diagnostics().as_ptr())
            .unwrap_or(core::ptr::null()),
        Err(_) => core::ptr::null(),
    }
}

/// Returns the byte length of diagnostics.
#[no_mangle]
pub extern "C" fn get_diagnostics_len() -> usize {
    match RUNTIME.lock() {
        Ok(guard) => guard
            .as_ref()
            .map(|runtime| runtime.diagnostics().len())
            .unwrap_or(0),
        Err(_) => 0,
    }
}

/// Resets the current context.
#[no_mangle]
pub extern "C" fn reset_context() -> u32 {
    with_runtime_mut(|runtime| runtime.reset_context())
}

/// Frees the loaded model.
#[no_mangle]
pub extern "C" fn free_model() -> u32 {
    with_runtime_mut(|runtime| runtime.free_model())
}

fn with_runtime_mut<F>(operation: F) -> u32
where
    F: FnOnce(&mut Runtime) -> ErrorCode,
{
    let Ok(mut guard) = RUNTIME.lock() else {
        return ErrorCode::GenerationFailed.as_u32();
    };
    match guard.as_mut() {
        Some(runtime) => operation(runtime).as_u32(),
        None => ErrorCode::ModelNotLoaded.as_u32(),
    }
}

fn set_error(error: ErrorCode) -> u32 {
    let Ok(mut guard) = RUNTIME.lock() else {
        return error.as_u32();
    };
    if guard.is_none() {
        *guard = Some(Runtime::new());
    }
    if let Some(runtime) = guard.as_mut() {
        runtime.record_boundary_error(error);
    }
    error.as_u32()
}
