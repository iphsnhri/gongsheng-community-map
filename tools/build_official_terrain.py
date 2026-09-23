"""Build the site terrain texture from NLSC's official 20 m DEM layers.

The output uses the same affine lon/lat-to-SVG transform as the county boundary
artwork, so terrain relief and administrative boundaries share one coordinate
system. Only the small set of WMTS tiles covering Taiwan is requested.
"""

from io import BytesIO
from math import floor, pi
from pathlib import Path
from urllib.request import Request, urlopen

import numpy as np
from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "dist" / "assets" / "taiwan-terrain-nlsc.png"
WIDTH, HEIGHT = 612, 760
ZOOM = 9
TILE_SIZE = 256

# The existing county artwork is intentionally widened to read well at the
# site's display size. Register the geographically projected DEM to that exact
# artwork so its coast and county outlines coincide on screen.
DISPLAY_SCALE_X = 1.29
DISPLAY_SCALE_Y = 1.09
DISPLAY_OFFSET_X = 38.0
DISPLAY_OFFSET_Y = 34.0

# The same transform used by app.js and by the generated county SVG.
AFFINE = np.array([[141.245689, 5.38768], [44.815674, -205.319895]])
OFFSET = np.array([-17012.9796, -262.636312])
INVERSE = np.linalg.inv(AFFINE)


def lonlat_to_tile(lon: float, lat: float) -> tuple[float, float]:
    scale = 2**ZOOM
    x = (lon + 180.0) / 360.0 * scale
    y = (1.0 - np.arcsinh(np.tan(np.radians(lat))) / pi) / 2.0 * scale
    return x, y


def tile_to_lonlat(x: np.ndarray, y: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    scale = 2**ZOOM
    lon = x / scale * 360.0 - 180.0
    lat = np.degrees(np.arctan(np.sinh(pi * (1.0 - 2.0 * y / scale))))
    return lon, lat


def fetch_layer(layer: str, x0: int, x1: int, y0: int, y1: int) -> Image.Image:
    canvas = Image.new("RGBA", ((x1 - x0 + 1) * TILE_SIZE, (y1 - y0 + 1) * TILE_SIZE))
    for tile_y in range(y0, y1 + 1):
        for tile_x in range(x0, x1 + 1):
            url = (
                f"https://wmts.nlsc.gov.tw/wmts/{layer}/default/"
                f"GoogleMapsCompatible/{ZOOM}/{tile_y}/{tile_x}"
            )
            request = Request(url, headers={"User-Agent": "gongsheng-community-map/1.0"})
            with urlopen(request, timeout=30) as response:
                tile = Image.open(BytesIO(response.read())).convert("RGBA")
            canvas.paste(tile, ((tile_x - x0) * TILE_SIZE, (tile_y - y0) * TILE_SIZE))
    return canvas


def main() -> None:
    # Tight geographic coverage for Taiwan proper; the site mask handles the coast.
    west, east, south, north = 119.45, 122.25, 21.75, 25.35
    tx0, ty0 = lonlat_to_tile(west, north)
    tx1, ty1 = lonlat_to_tile(east, south)
    x0, x1 = floor(tx0), floor(tx1)
    y0, y1 = floor(ty0), floor(ty1)

    rendered = fetch_layer("MOI_SHADERMAP", x0, x1, y0, y1)
    hillshade = fetch_layer("MOI_HILLSHADE", x0, x1, y0, y1)

    yy, xx = np.mgrid[0:HEIGHT, 0:WIDTH]
    svg_points = np.stack((xx, yy), axis=-1).reshape(-1, 2)
    lonlat = (svg_points - OFFSET) @ INVERSE.T
    lon = lonlat[:, 0].reshape(HEIGHT, WIDTH)
    lat = lonlat[:, 1].reshape(HEIGHT, WIDTH)
    tile_x, tile_y = lonlat_to_tile(lon, lat)
    sample_x = (tile_x - x0) * TILE_SIZE
    sample_y = (tile_y - y0) * TILE_SIZE

    # PIL's affine transform maps output pixels back into the stitched WMTS image.
    # The geographic transform is slightly non-linear in Y, so use a dense direct
    # sample at the final texture size instead of a single approximate matrix.
    sx = np.clip(np.rint(sample_x).astype(int), 0, rendered.width - 1)
    sy = np.clip(np.rint(sample_y).astype(int), 0, rendered.height - 1)
    render_pixels = np.asarray(rendered, dtype=np.float32)[sy, sx]
    shade_pixels = np.asarray(hillshade.convert("L"), dtype=np.float32)[sy, sx] / 255.0

    red, green = render_pixels[..., 0], render_pixels[..., 1]
    elevation = np.clip((red - green + 32.0) / 105.0, 0.0, 1.0)
    elevation = np.power(elevation, 0.9)

    low = np.array([185.0, 204.0, 157.0])
    middle = np.array([104.0, 139.0, 88.0])
    high = np.array([48.0, 79.0, 49.0])
    lower_mix = np.clip(elevation * 2.0, 0.0, 1.0)[..., None]
    upper_mix = np.clip((elevation - 0.5) * 2.0, 0.0, 1.0)[..., None]
    colour = low * (1.0 - lower_mix) + middle * lower_mix
    colour = colour * (1.0 - upper_mix) + high * upper_mix

    relief = (0.72 + shade_pixels * 0.48)[..., None]
    colour = np.clip(colour * relief, 0, 255).astype(np.uint8)
    alpha = render_pixels[..., 3:4].astype(np.uint8)
    projected = Image.fromarray(np.concatenate((colour, alpha), axis=-1), "RGBA")
    registered = projected.transform(
        (WIDTH, HEIGHT),
        Image.Transform.AFFINE,
        (
            1.0 / DISPLAY_SCALE_X,
            0.0,
            -DISPLAY_OFFSET_X / DISPLAY_SCALE_X,
            0.0,
            1.0 / DISPLAY_SCALE_Y,
            -DISPLAY_OFFSET_Y / DISPLAY_SCALE_Y,
        ),
        resample=Image.Resampling.BICUBIC,
    )

    # The SVG mask supplies the final official coastline. A soft lowland base
    # prevents one-pixel transparent seams caused by raster/vector sampling.
    output = Image.new("RGBA", (WIDTH, HEIGHT), (184, 204, 157, 255))
    output.alpha_composite(registered)
    output.save(OUTPUT, optimize=True)
    print(f"Wrote {OUTPUT} ({OUTPUT.stat().st_size:,} bytes) from tiles x{x0}-{x1}, y{y0}-{y1}.")


if __name__ == "__main__":
    main()
