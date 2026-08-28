# Vendored verovio

The toolkit built from the [verovio fork](https://github.com/pfefferniels/verovio)
branch `aligned-mei`, which adds the `performance*` options used throughout this
project: it lays a score out along the performed time of a `<recording>` instead
of along notated durations.

The upstream package on npm cannot do this, so the build is committed here and
`package.json` depends on it as `"verovio": "file:vendor/verovio"`. The entry
points are the same ones the official package exposes, so `verovio/wasm`,
`verovio/esm` and the `@types/verovio` typings all keep working unchanged.

Rebuild after changing the fork:

    npm run verovio:build

That needs the fork checked out at `~/Projects/verovio` on branch `aligned-mei`
and the Emscripten SDK at `~/emsdk`; see `tools/build-verovio.sh` for the
environment variables that move either of them. `build-info.json` records which
commit the current artefacts came from.
