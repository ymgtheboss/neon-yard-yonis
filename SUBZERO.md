# Subzero map integration

Run `npm start`, then open http://localhost:8000. Wait for **Subzero ready**, enter the arena, and start the round. The local server now uses Subzero by default. Publishing these changes to GitHub/Render is a separate step; this integration does not change the hosted deployment.

## Assets and performance

The supplied `Subzero || Krunker Map` GLB is retained as `public/maps/subzero-source.glb`. `npm run build:map` reproducibly generates the runtime GLB, collision mesh, compressed downloads and spawn data. The build uses the pinned Three.js dependency and needs no external services.

- Runtime GLB: 4,768,516 bytes, versus 9,040,944 bytes in the source.
- Gzip transfer: 1,029,564 bytes for graphics plus 180,952 bytes for collision.
- 86,611 rendered triangles; 29,809 solid collision triangles.
- Static geometry is partitioned by material and spatial region for frustum culling. Vertices are welded, colors packed into bytes, indices packed into 16 bits, and unused normals omitted from the unlit rendering asset.
- Original textures and vertex colors are retained. Unlit map materials avoid per-pixel lighting and map shadow rendering; player/weapon quality settings remain available.
- HTTP responses support gzip and ETag revalidation. The client waits for both graphics and collision before allowing entry.

The source unit scale is converted by 0.1 and recentered around the main arena. Geometry entirely outside the surrounding scenery region is omitted. These are intentional adaptations rather than a byte-for-byte map copy.

## Collision and gameplay

`map-collision.cjs` builds a static triangle bounding-volume hierarchy on both server and client. Bounding boxes reject irrelevant triangles; intersection tests use the actual triangles. Movement remains server-authoritative. Bullets, grenade collision, flash line of sight, labels and sound occlusion use the same solid mesh.

Players retain the game's upright box body, 0.72 m wide and 1.72 m tall. Movement uses substeps of at most 8 ms, headroom checks, a 0.285 m step limit, slope support, and ceiling checks. Sixteen spawn positions are selected on connected ground with standing clearance. Leaving the arena limits or falling below it returns the player to a valid spawn without refilling inventory.

Transparent source materials are treated as decorative overlays and excluded from collision, including their fully transparent areas. Solid opaque props remain collidable. Surface sounds currently use the generic concrete category. The map is static; no destructible scenery or moving doors are added.

## Verification

`npm test` runs 46 checks covering original-map gameplay regression checks, client logic checks, Subzero collision tests, actual GLB loader/geometry tests, and multiplayer HTTP/WebSocket tests. `node tests/browser.cjs` optionally runs an isolated headless Chrome smoke test on macOS; set `CHROME_PATH` for another Chrome binary.

The headless Chrome smoke test passed: textures loaded, the player joined, and a round started without uncaught JavaScript errors. This environment required SwiftShader software rendering (the observed 4 FPS is not a hardware benchmark); native pointer capture and hardware FPS remain unverified.

The collision suite checks spawn stability, thin walls, open doors, ceiling contact, ramps, and 9,600 varied movement ticks on Subzero. It also compares 192 rays against the actual rendered solid geometry. The multiplayer test exercises 15 concurrent connections. Local CPU timing is not a guarantee of browser FPS, Render server capacity, network latency or behavior on every device. Manual traversal and playtesting can still reveal places needing collision tuning.

For the old arena, run `WORLD_MAP=mill npm start`. `mill-world.cjs` preserves its original geometry and spawn definitions.

## Attribution

**Subzero || Krunker Map** by **Ale Nation**, from [Sketchfab](https://sketchfab.com/3d-models/subzero-krunker-map-64e50b50f57b43709a1ca4914cbe091e), licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), according to the embedded GLB metadata. Adaptations: scale/origin conversion, vertex welding, spatial partitioning, packed attributes, omission of remote geometry, unlit materials and derived collision/spawn data. Original author/source metadata is preserved in the compiled GLB and attribution is displayed in the game menu.
