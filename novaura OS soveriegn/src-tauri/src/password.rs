//! Profile passwords: PBKDF2-HMAC-SHA256 with a random salt, compared in constant time.
//! Kept free of Tauri so it can be checked against the published test vectors.

use sha2::{Digest, Sha256};

/// OWASP's 2023 figure for PBKDF2-HMAC-SHA256; about a third of a second on a desktop CPU.
pub const ITERATIONS: u32 = 600_000;

const BLOCK: usize = 64;

/// HMAC-SHA256 with the key's pads absorbed once, for the many MACs PBKDF2 makes.
struct Hmac {
    inner: Sha256,
    outer: Sha256,
}

impl Hmac {
    fn new(key: &[u8]) -> Self {
        let mut padded = [0u8; BLOCK];
        if key.len() > BLOCK {
            padded[..32].copy_from_slice(&Sha256::digest(key));
        } else {
            padded[..key.len()].copy_from_slice(key);
        }
        let mut inner = Sha256::new();
        inner.update(padded.map(|b| b ^ 0x36));
        let mut outer = Sha256::new();
        outer.update(padded.map(|b| b ^ 0x5c));
        Hmac { inner, outer }
    }

    fn mac(&self, message: &[u8]) -> [u8; 32] {
        let mut inner = self.inner.clone();
        inner.update(message);
        let mut outer = self.outer.clone();
        outer.update(inner.finalize());
        outer.finalize().into()
    }
}

#[cfg(test)]
pub fn hmac_sha256(key: &[u8], message: &[u8]) -> [u8; 32] {
    Hmac::new(key).mac(message)
}

/// PBKDF2-HMAC-SHA256 with a 32-byte result (a single block).
pub fn pbkdf2_sha256(password: &[u8], salt: &[u8], iterations: u32) -> [u8; 32] {
    let prf = Hmac::new(password);
    let mut first = Vec::with_capacity(salt.len() + 4);
    first.extend_from_slice(salt);
    first.extend_from_slice(&1u32.to_be_bytes());
    let mut u = prf.mac(&first);
    let mut out = u;
    for _ in 1..iterations.max(1) {
        u = prf.mac(&u);
        for (o, x) in out.iter_mut().zip(u) {
            *o ^= x;
        }
    }
    out
}

/// Equal-length comparison that takes the same time wherever the bytes differ.
pub fn same(a: &[u8], b: &[u8]) -> bool {
    a.len() == b.len() && a.iter().zip(b).fold(0u8, |acc, (x, y)| acc | (x ^ y)) == 0
}

pub fn to_hex(bytes: &[u8]) -> String {
    bytes.iter().map(|b| format!("{b:02x}")).collect()
}

pub fn from_hex(text: &str) -> Option<Vec<u8>> {
    if text.len() % 2 != 0 {
        return None;
    }
    (0..text.len())
        .step_by(2)
        .map(|i| u8::from_str_radix(text.get(i..i + 2)?, 16).ok())
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn hmac_matches_rfc_4231() {
        // Test case 2, and test case 6 (a key longer than the block).
        assert_eq!(
            to_hex(&hmac_sha256(b"Jefe", b"what do ya want for nothing?")),
            "5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843"
        );
        assert_eq!(
            to_hex(&hmac_sha256(&[0xaa; 131], b"Test Using Larger Than Block-Size Key - Hash Key First")),
            "60e431591ee0b67f0d8a26aacbf5b77f8e0bc6213728c5140546040f0ee37f54"
        );
    }

    #[test]
    fn pbkdf2_matches_known_vectors() {
        assert_eq!(
            to_hex(&pbkdf2_sha256(b"password", b"salt", 1)),
            "120fb6cffcf8b32c43e7225256c4f837a86548c92ccc35480805987cb70be17b"
        );
        assert_eq!(
            to_hex(&pbkdf2_sha256(b"password", b"salt", 2)),
            "ae4d0c95af6b46d32d0adff928f06dd02a303f8ef3c251dfd6e2d85a95474c43"
        );
        assert_eq!(
            to_hex(&pbkdf2_sha256(b"password", b"salt", 4096)),
            "c5e478d59288c841aa530db6845c4c8d962893a001ce4e11a4963873aa98134a"
        );
    }

    #[test]
    fn hex_round_trips_and_rejects_junk() {
        assert_eq!(from_hex(&to_hex(&[0, 15, 255])), Some(vec![0, 15, 255]));
        assert_eq!(from_hex("abc"), None);
        assert_eq!(from_hex("zz"), None);
        assert!(same(b"abc", b"abc") && !same(b"abc", b"abd") && !same(b"abc", b"ab"));
    }
}
