"""Combine the original illustrated island look with the calibrated NLSC relief."""

from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "dist" / "assets"
ORIGINAL = ASSETS / "taiwan-terrain-render-v2.png"
CALIBRATED = ASSETS / "taiwan-terrain-nlsc.png"
OUTPUT = ASSETS / "taiwan-terrain-calibrated.png"
WIDTH, HEIGHT = 612, 760


def relative_luminance(rgb: np.ndarray) -> np.ndarray:
    return rgb[..., 0] * 0.2126 + rgb[..., 1] * 0.7152 + rgb[..., 2] * 0.0722


def main() -> None:
    original = Image.open(ORIGINAL).convert("RGBA")
    # Reproduce the original site's 125% background sizing before calibration.
    original = original.resize((round(WIDTH * 1.25), round(HEIGHT * 1.25)), Image.Resampling.LANCZOS)
    left = (original.width - WIDTH) // 2
    top = (original.height - HEIGHT) // 2
    original = original.crop((left, top, left + WIDTH, top + HEIGHT))
    calibrated = Image.open(CALIBRATED).convert("RGBA").resize((WIDTH, HEIGHT), Image.Resampling.LANCZOS)

    old_rgba = np.asarray(original, dtype=np.float32)
    dem_rgba = np.asarray(calibrated, dtype=np.float32)
    lowland = np.array([184.0, 204.0, 157.0])
    old_alpha = old_rgba[..., 3:4] / 255.0
    old_rgb = old_rgba[..., :3] * old_alpha + lowland * (1.0 - old_alpha)
    dem_rgb = dem_rgba[..., :3]

    # Retain the original artwork in the mountains. The official DEM controls
    # how strongly that artwork is allowed through, so the western and
    # south-western plains do not inherit the old image's misplaced ridges.
    old_luma = relative_luminance(old_rgb)
    dem_luma = relative_luminance(dem_rgb)
    relief = np.clip((188.0 - dem_luma) / 72.0, 0.0, 1.0)
    relief = np.asarray(
        Image.fromarray((relief * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(7.5)),
        dtype=np.float32,
    ) / 255.0
    artwork_weight = (0.30 + relief * 0.58)[..., None]
    output_rgb = np.clip(old_rgb * artwork_weight + dem_rgb * (1.0 - artwork_weight), 0, 255).astype(np.uint8)

    output = Image.fromarray(
        np.dstack((output_rgb, np.full((HEIGHT, WIDTH), 255, dtype=np.uint8))),
        "RGBA",
    )
    output.save(OUTPUT, optimize=True)
    print(f"Wrote {OUTPUT} ({OUTPUT.stat().st_size:,} bytes).")


if __name__ == "__main__":
    main()
