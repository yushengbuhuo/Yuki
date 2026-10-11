# Three.js (local vendor)

Version: 0.180.0. Source: https://registry.npmjs.org/three/-/three-0.180.0.tgz

The ES module renderer, its core dependency, GLB loader and MIT license are included.
The browser loads these files locally; no CDN or runtime package installation is used.

- `package/build/three.module.js`
- `package/build/three.core.js`
- `package/LICENSE`
- `package/examples/jsm/loaders/GLTFLoader.js`
- `package/examples/jsm/utils/BufferGeometryUtils.js`

The two example modules are from the official `mrdoob/three.js` r180 tag.
Their `three` package imports point at the local `build/three.module.js`.
