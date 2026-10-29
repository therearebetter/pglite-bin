# pglite

A wrapper using `bun compile` around pglite to generate a standalone postgres binrary.

This binary can be useful for testing postgres applications without needing to use docker.

```bash
bun install
bun run build
```

Push a version tag such as `v1.0.0` to build standalone binaries for Linux
(x64 and ARM64), macOS (x64 and ARM64), and Windows (x64). The workflow
publishes each binary as an asset on the matching GitHub release.
