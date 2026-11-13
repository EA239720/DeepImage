use std::io::Cursor;

use image::codecs::jpeg::JpegEncoder;
use image::imageops::FilterType;
use image::{DynamicImage, ImageDecoder, ImageFormat, ImageReader, ImageResult};
use serde::Deserialize;

/// The largest side the frontend lets the user ask for.
const MAX_SIDE: u32 = 10_000;
const JPEG_QUALITY: u8 = 92;

/// How a saved image is brought to the requested size.
#[derive(Debug, Clone, Copy, PartialEq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum FitMode {
    /// Cut away the edges around the center, without scaling.
    Crop,
    /// Scale the whole image to exactly the size, stretching it if its proportions differ.
    Resize,
}

/// The size, in pixels, every saved image should have.
#[derive(Debug, Clone, Copy, Deserialize)]
pub struct Fit {
    pub mode: FitMode,
    pub width: u32,
    pub height: u32,
}

#[derive(Debug)]
pub struct Reshaped {
    pub bytes: Vec<u8>,
    pub width: u32,
    pub height: u32,
    /// Why the result is not quite the size asked for, when it is not.
    pub note: Option<String>,
}

/// Brings an encoded image to the size `fit` asks for, writing it back in the format that
/// `extension` names. The error is the note to show when the image has to be kept as it came.
pub fn reshape(encoded: &[u8], extension: &str, fit: Fit) -> Result<Reshaped, String> {
    let action = match fit.mode {
        FitMode::Crop => "recortar",
        FitMode::Resize => "redimensionar",
    };
    let kept = |reason: String| format!("Se guardó con su tamaño original: {reason}.");

    if !(1..=MAX_SIDE).contains(&fit.width) || !(1..=MAX_SIDE).contains(&fit.height) {
        return Err(kept(format!("{} × {} no es un tamaño válido", fit.width, fit.height)));
    }
    let format = ImageFormat::from_extension(extension)
        .filter(|format| {
            matches!(
                format,
                ImageFormat::Png
                    | ImageFormat::Jpeg
                    | ImageFormat::Gif
                    | ImageFormat::WebP
                    | ImageFormat::Bmp
                    | ImageFormat::Tiff
            )
        })
        .ok_or_else(|| kept(format!("las imágenes .{extension} no se pueden {action}")))?;

    let unreadable = |err: image::ImageError| kept(format!("no se pudo leer la imagen ({err})"));
    let mut decoder = ImageReader::new(Cursor::new(encoded))
        .with_guessed_format()
        .map_err(|err| kept(format!("no se pudo leer la imagen ({err})")))?
        .into_decoder()
        .map_err(unreadable)?;
    // Photos are often stored sideways with a tag saying how to turn them.
    let orientation = decoder.orientation().map_err(unreadable)?;
    let mut image = DynamicImage::from_decoder(decoder).map_err(unreadable)?;
    image.apply_orientation(orientation);

    let (width, height) = (image.width(), image.height());
    let mut note = None;
    let shaped = match fit.mode {
        FitMode::Crop => {
            let (kept_width, kept_height) = (fit.width.min(width), fit.height.min(height));
            if kept_width < fit.width || kept_height < fit.height {
                note = Some(format!(
                    "Mide {width} × {height}, menos que {} × {}: solo se recortó lo que sobraba.",
                    fit.width, fit.height
                ));
            }
            image.crop_imm((width - kept_width) / 2, (height - kept_height) / 2, kept_width, kept_height)
        }
        FitMode::Resize => image.resize_exact(fit.width, fit.height, FilterType::Lanczos3),
    };

    let bytes = encode(&shaped, format).map_err(|err| kept(format!("no se pudo guardar el resultado ({err})")))?;
    Ok(Reshaped {
        bytes,
        width: shaped.width(),
        height: shaped.height(),
        note,
    })
}

fn encode(image: &DynamicImage, format: ImageFormat) -> ImageResult<Vec<u8>> {
    let mut out = Cursor::new(Vec::new());
    match format {
        // JPEG has no transparency, and the default quality loses visible detail.
        ImageFormat::Jpeg => DynamicImage::ImageRgb8(image.to_rgb8())
            .write_with_encoder(JpegEncoder::new_with_quality(&mut out, JPEG_QUALITY))?,
        // These encoders only take 8-bit color.
        ImageFormat::Gif | ImageFormat::WebP | ImageFormat::Bmp => {
            DynamicImage::ImageRgba8(image.to_rgba8()).write_to(&mut out, format)?
        }
        _ => image.write_to(&mut out, format)?,
    }
    Ok(out.into_inner())
}

#[cfg(test)]
mod tests {
    use super::*;
    use image::{Rgb, RgbImage};

    const RED: Rgb<u8> = Rgb([200, 30, 30]);
    const GREEN: Rgb<u8> = Rgb([30, 200, 30]);

    /// A `width` × `height` image, red with a green rectangle `margin` pixels in from every edge.
    fn framed(width: u32, height: u32, margin: u32, format: ImageFormat) -> Vec<u8> {
        let image = RgbImage::from_fn(width, height, |x, y| {
            let inside = x >= margin && x < width - margin && y >= margin && y < height - margin;
            if inside { GREEN } else { RED }
        });
        let mut out = Cursor::new(Vec::new());
        DynamicImage::ImageRgb8(image).write_to(&mut out, format).unwrap();
        out.into_inner()
    }

    fn decode(bytes: &[u8]) -> DynamicImage {
        image::load_from_memory(bytes).unwrap()
    }

    fn fit(mode: FitMode, width: u32, height: u32) -> Fit {
        Fit { mode, width, height }
    }

    #[test]
    fn crops_from_the_edges_around_the_center() {
        // 1600 × 1600 cropped to 1000 × 1000 loses 300 pixels on every side: exactly the red frame.
        let source = framed(1600, 1600, 300, ImageFormat::Png);
        let result = reshape(&source, "png", fit(FitMode::Crop, 1000, 1000)).unwrap();

        assert_eq!((result.width, result.height), (1000, 1000));
        assert_eq!(result.note, None);
        let image = decode(&result.bytes).to_rgb8();
        assert_eq!(image.dimensions(), (1000, 1000));
        for (x, y) in [(0, 0), (999, 0), (0, 999), (999, 999), (500, 500)] {
            assert_eq!(*image.get_pixel(x, y), GREEN, "pixel {x},{y}");
        }
    }

    #[test]
    fn crops_each_side_independently() {
        let source = framed(1600, 900, 0, ImageFormat::Png);
        let result = reshape(&source, "png", fit(FitMode::Crop, 1200, 600)).unwrap();
        assert_eq!((result.width, result.height), (1200, 600));
    }

    #[test]
    fn crops_only_what_exceeds_a_smaller_image() {
        let source = framed(800, 1200, 0, ImageFormat::Png);
        let result = reshape(&source, "png", fit(FitMode::Crop, 1000, 1000)).unwrap();
        assert_eq!((result.width, result.height), (800, 1000));
        assert!(result.note.unwrap().contains("800 × 1200"));
    }

    #[test]
    fn resizes_the_whole_image_to_the_requested_size() {
        let source = framed(1600, 800, 100, ImageFormat::Png);
        let result = reshape(&source, "png", fit(FitMode::Resize, 500, 500)).unwrap();
        assert_eq!((result.width, result.height), (500, 500));
        // Scaled, not cut: the red frame is still there at the edges.
        let image = decode(&result.bytes).to_rgb8();
        assert_eq!(*image.get_pixel(0, 0), RED);
        // Enlarging works too.
        let larger = reshape(&source, "png", fit(FitMode::Resize, 2000, 1000)).unwrap();
        assert_eq!((larger.width, larger.height), (2000, 1000));
    }

    #[test]
    fn keeps_the_format_of_the_file() {
        let jpeg = framed(400, 400, 50, ImageFormat::Jpeg);
        let result = reshape(&jpeg, "jpg", fit(FitMode::Crop, 300, 300)).unwrap();
        assert!(result.bytes.starts_with(&[0xFF, 0xD8, 0xFF]));
        let decoded = decode(&result.bytes);
        assert_eq!((decoded.width(), decoded.height()), (300, 300));

        let png = framed(400, 400, 50, ImageFormat::Png);
        let webp = reshape(&png, "webp", fit(FitMode::Resize, 100, 100)).unwrap();
        assert_eq!(&webp.bytes[8..12], b"WEBP");
    }

    #[test]
    fn keeps_the_image_when_it_cannot_change_it() {
        let svg = br#"<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>"#;
        let unsupported = reshape(svg, "svg", fit(FitMode::Crop, 5, 5)).unwrap_err();
        assert!(unsupported.contains("no se pueden recortar"));

        let broken = reshape(b"not an image", "png", fit(FitMode::Resize, 5, 5)).unwrap_err();
        assert!(broken.starts_with("Se guardó con su tamaño original"));

        let source = framed(10, 10, 0, ImageFormat::Png);
        assert!(reshape(&source, "png", fit(FitMode::Crop, 0, 10)).is_err());
        assert!(reshape(&source, "png", fit(FitMode::Crop, 10, MAX_SIDE + 1)).is_err());
    }

    #[test]
    fn reads_the_size_requested_by_the_frontend() {
        let parsed: Fit = serde_json::from_str(r#"{ "mode": "crop", "width": 1000, "height": 800 }"#).unwrap();
        assert_eq!((parsed.mode, parsed.width, parsed.height), (FitMode::Crop, 1000, 800));
        let resize: Fit = serde_json::from_str(r#"{ "mode": "resize", "width": 1, "height": 2 }"#).unwrap();
        assert_eq!(resize.mode, FitMode::Resize);
    }
}
