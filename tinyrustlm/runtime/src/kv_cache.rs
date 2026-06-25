//! Key/value cache for autoregressive attention.

use crate::errors::ErrorCode;

/// Layer-major key/value cache.
pub struct KvCache {
    layers: usize,
    max_context: usize,
    kv_heads: usize,
    head_dim: usize,
    len: usize,
    keys: Vec<f32>,
    values: Vec<f32>,
}

impl KvCache {
    /// Creates a new zero-initialized key/value cache.
    pub fn new(
        layers: usize,
        max_context: usize,
        kv_heads: usize,
        head_dim: usize,
    ) -> Result<Self, ErrorCode> {
        if layers == 0 || max_context == 0 || kv_heads == 0 || head_dim == 0 {
            return Err(ErrorCode::ShapeMismatch);
        }
        let total = layers
            .checked_mul(max_context)
            .and_then(|v| v.checked_mul(kv_heads))
            .and_then(|v| v.checked_mul(head_dim))
            .ok_or(ErrorCode::InvalidLength)?;
        Ok(Self {
            layers,
            max_context,
            kv_heads,
            head_dim,
            len: 0,
            keys: vec![0.0; total],
            values: vec![0.0; total],
        })
    }

    /// Returns the current token count in the cache.
    pub fn len(&self) -> usize {
        self.len
    }

    /// Returns whether the cache is empty.
    pub fn is_empty(&self) -> bool {
        self.len == 0
    }

    /// Clears all cached positions.
    pub fn reset(&mut self) {
        self.len = 0;
    }

    /// Commits the visible cache length after all layers store a position.
    pub fn commit_len(&mut self, len: usize) -> Result<(), ErrorCode> {
        if len > self.max_context {
            return Err(ErrorCode::ContextExceeded);
        }
        self.len = len;
        Ok(())
    }

    /// Appends a single position for one layer.
    pub fn append_layer(
        &mut self,
        layer: usize,
        key: &[f32],
        value: &[f32],
    ) -> Result<(), ErrorCode> {
        if layer >= self.layers || self.len >= self.max_context {
            return Err(ErrorCode::ContextExceeded);
        }
        let expected = self.kv_heads * self.head_dim;
        if key.len() != expected || value.len() != expected {
            return Err(ErrorCode::ShapeMismatch);
        }
        let base = self.offset(layer, self.len, 0, 0)?;
        self.keys[base..base + expected].copy_from_slice(key);
        self.values[base..base + expected].copy_from_slice(value);
        if layer + 1 == self.layers {
            self.len += 1;
        }
        Ok(())
    }

    /// Stores a single layer at an explicit token position.
    pub fn store_layer_at(
        &mut self,
        layer: usize,
        position: usize,
        key: &[f32],
        value: &[f32],
    ) -> Result<(), ErrorCode> {
        if layer >= self.layers || position >= self.max_context {
            return Err(ErrorCode::ContextExceeded);
        }
        let expected = self.kv_heads * self.head_dim;
        if key.len() != expected || value.len() != expected {
            return Err(ErrorCode::ShapeMismatch);
        }
        let base = self.offset(layer, position, 0, 0)?;
        self.keys[base..base + expected].copy_from_slice(key);
        self.values[base..base + expected].copy_from_slice(value);
        Ok(())
    }

    /// Reads a cached key vector for one layer and position.
    pub fn key(&self, layer: usize, position: usize) -> Result<&[f32], ErrorCode> {
        self.read(&self.keys, layer, position)
    }

    /// Reads a cached value vector for one layer and position.
    pub fn value(&self, layer: usize, position: usize) -> Result<&[f32], ErrorCode> {
        self.read(&self.values, layer, position)
    }

    /// Reads a cached key head at a position that has been stored.
    pub fn key_head_at(
        &self,
        layer: usize,
        position: usize,
        head: usize,
    ) -> Result<&[f32], ErrorCode> {
        self.read_head(&self.keys, layer, position, head)
    }

    /// Reads a cached value head at a position that has been stored.
    pub fn value_head_at(
        &self,
        layer: usize,
        position: usize,
        head: usize,
    ) -> Result<&[f32], ErrorCode> {
        self.read_head(&self.values, layer, position, head)
    }

    fn read<'a>(
        &self,
        store: &'a [f32],
        layer: usize,
        position: usize,
    ) -> Result<&'a [f32], ErrorCode> {
        if layer >= self.layers || position >= self.len {
            return Err(ErrorCode::ContextExceeded);
        }
        let expected = self.kv_heads * self.head_dim;
        let base = self.offset(layer, position, 0, 0)?;
        Ok(&store[base..base + expected])
    }

    fn read_head<'a>(
        &self,
        store: &'a [f32],
        layer: usize,
        position: usize,
        head: usize,
    ) -> Result<&'a [f32], ErrorCode> {
        if layer >= self.layers || position >= self.max_context || head >= self.kv_heads {
            return Err(ErrorCode::ContextExceeded);
        }
        let base = self.offset(layer, position, head, 0)?;
        Ok(&store[base..base + self.head_dim])
    }

    fn offset(
        &self,
        layer: usize,
        position: usize,
        head: usize,
        dim: usize,
    ) -> Result<usize, ErrorCode> {
        if layer >= self.layers
            || position >= self.max_context
            || head >= self.kv_heads
            || dim >= self.head_dim
        {
            return Err(ErrorCode::ShapeMismatch);
        }
        Ok((((layer * self.max_context + position) * self.kv_heads + head) * self.head_dim) + dim)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn kv_cache_append_read() {
        let mut cache = KvCache::new(1, 4, 2, 2).unwrap();
        cache
            .append_layer(0, &[1.0, 2.0, 3.0, 4.0], &[5.0, 6.0, 7.0, 8.0])
            .unwrap();
        assert_eq!(cache.len(), 1);
        assert_eq!(cache.key(0, 0).unwrap(), &[1.0, 2.0, 3.0, 4.0]);
        assert_eq!(cache.value(0, 0).unwrap(), &[5.0, 6.0, 7.0, 8.0]);
    }
}
