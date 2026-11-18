//! Reading a local AI server's HTTP reply while it is still being written.
//!
//! Tauri-free so `npm run tauri:test` can test it (see `pure-tests`).

/// Turns the raw bytes of an HTTP/1.1 response into body text as they arrive:
/// headers first, then the body, plain or chunked. Text is handed out only in whole
/// UTF-8 characters, so a character split across two reads is never garbled.
pub struct ResponseDecoder {
    status: Option<u16>,
    /// Header bytes until the blank line that ends them.
    head: Vec<u8>,
    in_body: bool,
    chunked: bool,
    chunk: Chunk,
    /// Chunked framing not yet complete.
    framing: Vec<u8>,
    /// Body bytes that end partway through a UTF-8 character.
    tail: Vec<u8>,
}

#[derive(Clone, Copy)]
enum Chunk {
    Size,
    Data(usize),
    DataEnd,
    Done,
}

impl Default for ResponseDecoder {
    fn default() -> Self {
        Self::new()
    }
}

impl ResponseDecoder {
    pub fn new() -> Self {
        Self {
            status: None,
            head: Vec::new(),
            in_body: false,
            chunked: false,
            chunk: Chunk::Size,
            framing: Vec::new(),
            tail: Vec::new(),
        }
    }

    /// The status code, once the status line has arrived.
    pub fn status(&self) -> Option<u16> {
        self.status
    }

    /// Feed the next bytes read from the socket; returns the body text they complete.
    pub fn push(&mut self, bytes: &[u8]) -> String {
        let mut body = Vec::new();
        if self.in_body {
            self.feed(bytes, &mut body);
        } else {
            self.head.extend_from_slice(bytes);
            if self.status.is_none() {
                if let Some(nl) = self.head.iter().position(|&b| b == b'\n') {
                    let line = String::from_utf8_lossy(&self.head[..nl]);
                    self.status = line.split_whitespace().nth(1).and_then(|s| s.parse().ok()).or(Some(0));
                }
            }
            if let Some((end, sep)) = header_end(&self.head) {
                let headers = String::from_utf8_lossy(&self.head[..end]).to_ascii_lowercase();
                self.chunked = headers
                    .lines()
                    .any(|l| l.starts_with("transfer-encoding:") && l.contains("chunked"));
                let rest = self.head.split_off(end + sep);
                self.head = Vec::new();
                self.in_body = true;
                self.feed(&rest, &mut body);
            }
        }
        self.text(body)
    }

    /// Whatever is left once the server has closed the connection.
    pub fn finish(&mut self) -> String {
        let tail = std::mem::take(&mut self.tail);
        String::from_utf8_lossy(&tail).into_owned()
    }

    fn feed(&mut self, bytes: &[u8], body: &mut Vec<u8>) {
        if !self.chunked {
            body.extend_from_slice(bytes);
            return;
        }
        self.framing.extend_from_slice(bytes);
        let buf = std::mem::take(&mut self.framing);
        let mut i = 0;
        while i < buf.len() {
            match self.chunk {
                Chunk::Size => {
                    let Some(nl) = buf[i..].iter().position(|&b| b == b'\n') else { break };
                    let line = String::from_utf8_lossy(&buf[i..i + nl]);
                    let size = line.split(';').next().unwrap_or("").trim();
                    i += nl + 1;
                    self.chunk = match usize::from_str_radix(size, 16) {
                        Ok(0) | Err(_) => Chunk::Done,
                        Ok(n) => Chunk::Data(n),
                    };
                }
                Chunk::Data(n) => {
                    let take = (buf.len() - i).min(n);
                    body.extend_from_slice(&buf[i..i + take]);
                    i += take;
                    self.chunk = if take == n { Chunk::DataEnd } else { Chunk::Data(n - take) };
                }
                Chunk::DataEnd => {
                    let Some(nl) = buf[i..].iter().position(|&b| b == b'\n') else { break };
                    i += nl + 1;
                    self.chunk = Chunk::Size;
                }
                Chunk::Done => {
                    i = buf.len();
                }
            }
        }
        self.framing = buf[i..].to_vec();
    }

    fn text(&mut self, body: Vec<u8>) -> String {
        let mut bytes = std::mem::take(&mut self.tail);
        bytes.extend_from_slice(&body);
        let keep = incomplete_utf8_tail(&bytes);
        self.tail = bytes.split_off(bytes.len() - keep);
        String::from_utf8_lossy(&bytes).into_owned()
    }
}

/// Where the headers end: the index of the blank line and its length (CRLF or bare LF).
fn header_end(head: &[u8]) -> Option<(usize, usize)> {
    let crlf = head.windows(4).position(|w| w == b"\r\n\r\n").map(|i| (i, 4));
    let lf = head.windows(2).position(|w| w == b"\n\n").map(|i| (i, 2));
    match (crlf, lf) {
        (Some(a), Some(b)) => Some(if a.0 <= b.0 { a } else { b }),
        (a, b) => a.or(b),
    }
}

/// How many bytes at the end start a UTF-8 character that is not complete yet.
fn incomplete_utf8_tail(bytes: &[u8]) -> usize {
    for back in 1..=bytes.len().min(3) {
        let b = bytes[bytes.len() - back];
        if b & 0xC0 == 0x80 {
            continue;
        }
        let need = if b >= 0xF0 {
            4
        } else if b >= 0xE0 {
            3
        } else if b >= 0xC0 {
            2
        } else {
            1
        };
        return if need > back { back } else { 0 };
    }
    0
}

#[cfg(test)]
mod tests {
    use super::*;

    fn feed_in_pieces(raw: &[u8], size: usize) -> (Option<u16>, String) {
        let mut dec = ResponseDecoder::new();
        let mut out = String::new();
        for piece in raw.chunks(size) {
            out.push_str(&dec.push(piece));
        }
        out.push_str(&dec.finish());
        (dec.status(), out)
    }

    #[test]
    fn a_plain_body_comes_out_whole_however_it_is_split() {
        let raw = b"HTTP/1.1 200 OK\r\nContent-Type: application/x-ndjson\r\n\r\n{\"a\":1}\n{\"b\":2}\n";
        for size in [1, 2, 5, 17, raw.len()] {
            assert_eq!(feed_in_pieces(raw, size), (Some(200), "{\"a\":1}\n{\"b\":2}\n".to_string()), "split into {size}-byte reads");
        }
    }

    #[test]
    fn chunked_framing_is_removed_however_it_is_split() {
        let raw = b"HTTP/1.1 200 OK\r\nTransfer-Encoding: chunked\r\n\r\n7\r\ndata: a\r\na;ext=1\r\n\n\ndata: bc\r\n0\r\n\r\n";
        for size in [1, 3, 8, raw.len()] {
            assert_eq!(feed_in_pieces(raw, size), (Some(200), "data: a\n\ndata: bc".to_string()), "split into {size}-byte reads");
        }
    }

    #[test]
    fn a_character_split_across_reads_is_not_garbled() {
        let text = "héllo ✓ 😀 done";
        let raw = format!("HTTP/1.1 200 OK\r\nTransfer-Encoding: chunked\r\n\r\n{:x}\r\n{}\r\n0\r\n\r\n", text.len(), text);
        let (_, out) = feed_in_pieces(raw.as_bytes(), 1);
        assert_eq!(out, text);
        assert!(!out.contains('\u{FFFD}'));
    }

    #[test]
    fn text_comes_out_as_soon_as_it_arrives() {
        let mut dec = ResponseDecoder::new();
        assert_eq!(dec.push(b"HTTP/1.1 200 OK\r\nTransfer-Enc"), "");
        assert_eq!(dec.status(), Some(200), "the status line is read before the headers end");
        assert_eq!(dec.push(b"oding: chunked\r\n\r\n5\r\nhel"), "hel");
        assert_eq!(dec.push(b"lo\r\n"), "lo");
        assert_eq!(dec.push(b"0\r\n\r\n"), "");
    }

    #[test]
    fn an_error_status_and_its_body_are_kept() {
        let raw = b"HTTP/1.1 400 Bad Request\r\nContent-Length: 27\r\n\r\n{\"error\":\"think not valid\"}";
        assert_eq!(feed_in_pieces(raw, 4), (Some(400), "{\"error\":\"think not valid\"}".to_string()));
    }

    #[test]
    fn bare_newlines_in_the_headers_are_accepted() {
        let raw = b"HTTP/1.0 200 OK\nContent-Type: text/event-stream\n\ndata: x\n\n";
        assert_eq!(feed_in_pieces(raw, 3), (Some(200), "data: x\n\n".to_string()));
    }
}
