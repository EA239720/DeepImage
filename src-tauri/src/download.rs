use std::path::Path;
use std::time::Duration;

use reqwest::header::CONTENT_TYPE;
use serde::Serialize;

/// Longest slice of a non-image response kept for the issue detail view.
const BODY_PREVIEW_CHARS: usize = 2000;

/// What the server answered for one URL.
#[derive(Debug, Serialize)]
#[serde(
    tag = "kind",
    rename_all = "camelCase",
    rename_all_fields = "camelCase"
)]
pub enum Outcome {
    /// The response was an image and is now on disk as `file`.
    Saved {
        file: String,
        bytes: u64,
        content_type: String,
    },
    /// A successful response whose body is not an image (XML, HTML, …).
    NotImage {
        status: u16,
        status_text: String,
        content_type: String,
        body: String,
    },
    /// The server answered with a non-2xx status.
    HttpError {
        status: u16,
        status_text: String,
        content_type: String,
        body: String,
    },
}

/// A request that never produced a response, or an image that could not be written.
#[derive(Debug, Serialize)]
pub struct DownloadError {
    /// `url`, `network` or `io`.
    kind: &'static str,
    message: String,
}

impl From<reqwest::Error> for DownloadError {
    fn from(err: reqwest::Error) -> Self {
        let kind = if err.is_builder() { "url" } else { "network" };
        // reqwest's Display stops at the top-level message; the cause carries the useful part.
        let mut message = err.to_string();
        let mut source = std::error::Error::source(&err);
        while let Some(cause) = source {
            message.push_str(": ");
            message.push_str(&cause.to_string());
            source = cause.source();
        }
        Self { kind, message }
    }
}

impl From<std::io::Error> for DownloadError {
    fn from(err: std::io::Error) -> Self {
        Self {
            kind: "io",
            message: err.to_string(),
        }
    }
}

pub fn http_client() -> reqwest::Client {
    reqwest::Client::builder()
        .user_agent(concat!("Lote/", env!("CARGO_PKG_VERSION")))
        .connect_timeout(Duration::from_secs(15))
        .timeout(Duration::from_secs(120))
        .build()
        .expect("failed to build the HTTP client")
}

/// Requests `url` and, when the answer is an image, writes it to `dir` as `stem` plus the
/// extension of the image type.
pub async fn fetch_image(
    client: &reqwest::Client,
    url: &str,
    dir: &Path,
    stem: &str,
) -> Result<Outcome, DownloadError> {
    let response = client.get(url).send().await?;
    let status = response.status();
    let status_text = status.canonical_reason().unwrap_or_default().to_string();
    let content_type = response
        .headers()
        .get(CONTENT_TYPE)
        .and_then(|value| value.to_str().ok())
        .and_then(|value| value.split(';').next())
        .map(|value| value.trim().to_ascii_lowercase())
        .unwrap_or_default();
    let body = response.bytes().await?;

    if !status.is_success() {
        return Ok(Outcome::HttpError {
            status: status.as_u16(),
            status_text,
            content_type,
            body: body_preview(&body),
        });
    }

    let Some(extension) = image_extension(&content_type, &body) else {
        return Ok(Outcome::NotImage {
            status: status.as_u16(),
            status_text,
            content_type,
            body: body_preview(&body),
        });
    };

    let file = format!("{}.{extension}", sanitize_stem(stem));
    tokio::fs::create_dir_all(dir).await?;
    tokio::fs::write(dir.join(&file), &body).await?;

    Ok(Outcome::Saved {
        file,
        bytes: body.len() as u64,
        content_type,
    })
}

/// File extension for an image response, or `None` when the body is not an image.
///
/// The bytes win over the header: blob stores often serve images as
/// `application/octet-stream`.
fn image_extension(content_type: &str, body: &[u8]) -> Option<String> {
    if body.is_empty() {
        return None;
    }
    if let Some(extension) = sniff_extension(body) {
        return Some(extension.to_string());
    }
    let subtype = content_type.strip_prefix("image/")?;
    let extension = match subtype {
        "jpeg" | "jpg" | "pjpeg" => "jpg",
        "svg+xml" => "svg",
        "tiff" => "tif",
        "x-icon" | "vnd.microsoft.icon" => "ico",
        other => other,
    };
    let extension: String = extension
        .chars()
        .filter(|c| c.is_ascii_alphanumeric())
        .collect();
    (!extension.is_empty()).then_some(extension)
}

fn sniff_extension(body: &[u8]) -> Option<&'static str> {
    if body.starts_with(&[0xFF, 0xD8, 0xFF]) {
        return Some("jpg");
    }
    if body.starts_with(&[0x89, b'P', b'N', b'G', 0x0D, 0x0A, 0x1A, 0x0A]) {
        return Some("png");
    }
    if body.starts_with(b"GIF87a") || body.starts_with(b"GIF89a") {
        return Some("gif");
    }
    if body.starts_with(b"II*\0") || body.starts_with(b"MM\0*") {
        return Some("tif");
    }
    if body.len() >= 12 && &body[..4] == b"RIFF" && &body[8..12] == b"WEBP" {
        return Some("webp");
    }
    if body.len() >= 12 && &body[4..8] == b"ftyp" {
        return match &body[8..12] {
            b"avif" | b"avis" => Some("avif"),
            b"heic" | b"heix" | b"hevc" | b"mif1" | b"msf1" => Some("heic"),
            _ => None,
        };
    }
    None
}

/// Turns a rendered name template into a single safe file name component.
fn sanitize_stem(stem: &str) -> String {
    let cleaned: String = stem
        .chars()
        .map(|c| match c {
            '<' | '>' | ':' | '"' | '/' | '\\' | '|' | '?' | '*' => '_',
            c if c.is_control() => '_',
            c => c,
        })
        .collect();
    // Windows rejects names that end in a dot or a space.
    let cleaned = cleaned.trim().trim_end_matches(['.', ' ']);
    if cleaned.is_empty() {
        "imagen".to_string()
    } else {
        cleaned.to_string()
    }
}

fn body_preview(body: &[u8]) -> String {
    if body.iter().take(512).any(|&byte| byte == 0) {
        return String::new();
    }
    String::from_utf8_lossy(body)
        .trim()
        .chars()
        .take(BODY_PREVIEW_CHARS)
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use tokio::io::{AsyncReadExt, AsyncWriteExt};
    use tokio::net::TcpListener;

    const PNG: &[u8] = &[0x89, b'P', b'N', b'G', 0x0D, 0x0A, 0x1A, 0x0A, 0, 0, 0, 0];
    const JPEG: &[u8] = &[0xFF, 0xD8, 0xFF, 0xE0, 0, 0x10, b'J', b'F', b'I', b'F'];
    const BLOB_NOT_FOUND: &str =
        "<?xml version=\"1.0\"?><Error><Code>BlobNotFound</Code></Error>";

    /// Serves canned responses by path until the test ends; returns the base URL.
    async fn serve() -> String {
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let base = format!("http://{}", listener.local_addr().unwrap());
        tokio::spawn(async move {
            loop {
                let Ok((mut socket, _)) = listener.accept().await else {
                    return;
                };
                tokio::spawn(async move {
                    let mut request = vec![0u8; 2048];
                    let read = socket.read(&mut request).await.unwrap_or(0);
                    let request = String::from_utf8_lossy(&request[..read]).to_string();
                    let path = request.split_whitespace().nth(1).unwrap_or("/");
                    let (status, content_type, body): (&str, &str, &[u8]) = match path {
                        "/a_1" => ("200 OK", "image/png", PNG),
                        "/a_2" => ("200 OK", "application/octet-stream", JPEG),
                        "/xml" => ("200 OK", "application/xml; charset=utf-8", BLOB_NOT_FOUND.as_bytes()),
                        _ => ("404 Not Found", "application/xml", BLOB_NOT_FOUND.as_bytes()),
                    };
                    let head = format!(
                        "HTTP/1.1 {status}\r\nContent-Type: {content_type}\r\nContent-Length: {}\r\nConnection: close\r\n\r\n",
                        body.len()
                    );
                    let _ = socket.write_all(head.as_bytes()).await;
                    let _ = socket.write_all(body).await;
                });
            }
        });
        base
    }

    fn scratch_dir(name: &str) -> std::path::PathBuf {
        let dir = std::env::temp_dir().join(format!("lote-{name}-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        dir
    }

    #[tokio::test]
    async fn saves_images_and_reports_everything_else() {
        let base = serve().await;
        let client = http_client();
        // The destination does not exist yet: saving creates it.
        let dir = scratch_dir("fetch").join("nested");

        let saved = fetch_image(&client, &format!("{base}/a_1"), &dir, "CA-100.MAIN")
            .await
            .unwrap();
        match saved {
            Outcome::Saved { file, bytes, content_type } => {
                assert_eq!(file, "CA-100.MAIN.png");
                assert_eq!(bytes, PNG.len() as u64);
                assert_eq!(content_type, "image/png");
            }
            other => panic!("expected a saved image, got {other:?}"),
        }
        assert_eq!(std::fs::read(dir.join("CA-100.MAIN.png")).unwrap(), PNG);

        // Served as octet-stream: the extension comes from the bytes.
        let sniffed = fetch_image(&client, &format!("{base}/a_2"), &dir, "CA-100.MAIN_2")
            .await
            .unwrap();
        assert!(matches!(sniffed, Outcome::Saved { ref file, .. } if file == "CA-100.MAIN_2.jpg"));

        let xml = fetch_image(&client, &format!("{base}/xml"), &dir, "CA-101.MAIN")
            .await
            .unwrap();
        match xml {
            Outcome::NotImage { status, content_type, body, .. } => {
                assert_eq!(status, 200);
                assert_eq!(content_type, "application/xml");
                assert!(body.contains("BlobNotFound"));
            }
            other => panic!("expected a non-image answer, got {other:?}"),
        }

        let missing = fetch_image(&client, &format!("{base}/a_3"), &dir, "CA-100.MAIN_3")
            .await
            .unwrap();
        match missing {
            Outcome::HttpError { status, status_text, body, .. } => {
                assert_eq!(status, 404);
                assert_eq!(status_text, "Not Found");
                assert!(body.contains("BlobNotFound"));
            }
            other => panic!("expected an HTTP error, got {other:?}"),
        }

        // Only the two images reached the disk.
        assert_eq!(std::fs::read_dir(&dir).unwrap().count(), 2);
        let _ = std::fs::remove_dir_all(dir.parent().unwrap());
    }

    #[tokio::test]
    async fn classifies_failed_requests() {
        let client = http_client();
        let dir = scratch_dir("errors");

        let invalid = fetch_image(&client, "sin-esquema/[clave]", &dir, "x")
            .await
            .unwrap_err();
        assert_eq!(invalid.kind, "url");

        // Nothing listens on port 1.
        let refused = fetch_image(&client, "http://127.0.0.1:1/x", &dir, "x")
            .await
            .unwrap_err();
        assert_eq!(refused.kind, "network");
        assert!(!dir.exists());
    }

    #[test]
    fn serializes_outcomes_for_the_frontend() {
        let saved = Outcome::Saved {
            file: "a.jpg".into(),
            bytes: 3,
            content_type: "image/jpeg".into(),
        };
        assert_eq!(
            serde_json::to_value(saved).unwrap(),
            serde_json::json!({ "kind": "saved", "file": "a.jpg", "bytes": 3, "contentType": "image/jpeg" })
        );
        let missing = Outcome::HttpError {
            status: 404,
            status_text: "Not Found".into(),
            content_type: String::new(),
            body: String::new(),
        };
        assert_eq!(
            serde_json::to_value(missing).unwrap(),
            serde_json::json!({ "kind": "httpError", "status": 404, "statusText": "Not Found", "contentType": "", "body": "" })
        );
    }

    #[test]
    fn picks_extensions() {
        assert_eq!(image_extension("image/jpeg", b"not sniffable").as_deref(), Some("jpg"));
        assert_eq!(image_extension("image/svg+xml", b"<svg/>").as_deref(), Some("svg"));
        assert_eq!(image_extension("binary/octet-stream", PNG).as_deref(), Some("png"));
        assert_eq!(image_extension("text/html", JPEG).as_deref(), Some("jpg"));
        assert_eq!(image_extension("application/xml", b"<Error/>"), None);
        assert_eq!(image_extension("image/png", b""), None);
    }

    #[test]
    fn sanitizes_names() {
        assert_eq!(sanitize_stem("CA-100.MAIN"), "CA-100.MAIN");
        assert_eq!(sanitize_stem("a/b\\c:d"), "a_b_c_d");
        assert_eq!(sanitize_stem("../secreto"), ".._secreto");
        assert_eq!(sanitize_stem("nombre. "), "nombre");
        assert_eq!(sanitize_stem("  "), "imagen");
    }
}
