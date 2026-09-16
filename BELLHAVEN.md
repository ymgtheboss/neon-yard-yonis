# Bellhaven map and arena selection

Bellhaven is a new arena assembled from the supplied **Medieval Village MegaKit [Standard]** by Quaternius. Its glTF models and textures work directly with the game's Three.js renderer; FBX/OBJ copies from the ZIP are not needed at runtime.

The original Subzero map remains installed and is still the default. The host can select **Subzero** or **Bellhaven** in the lobby's **ARENA** dropdown. After a round, the results screen also has a **NEXT ARENA** dropdown. A map change keeps the same room and connected players, returns the room to the lobby, clears round objects, and respawns players on the selected map. The server rejects map changes during a round and waits for every player to acknowledge the current map version before allowing the next round to start.

Run locally with:

```sh
npm start
```

Open the address printed by the server (normally **http://localhost:8000**). Join the arena, select Bellhaven as the host, wait for the ready count, and start the round. To launch directly into Bellhaven:

```sh
WORLD_MAP=village npm start
```

`WORLD_MAP=mill npm start` retains the legacy Mill District for regression testing.

## Layout

The bounded arena is **120 × 120**, compared with Subzero's **84 × 84** bounds: **2.04 times the map footprint**. This is the agreed width/depth interpretation of “about twice as big”; it does not mean doubled width and doubled depth. The amount of usable space also depends on building density and narrow passages, so footprint is not an exact measure of connected walking area.

Three longitudinal streets connect through cross-streets and side approaches. The bell tower and market are the central landmark; Cooper Street and Garden Walk provide flank routes. Gatehouses, wagons, crates, shop counters, and masonry planters break up sightlines. Two ground-floor interiors are accessible, and two stairways reach raised balconies. Sixteen spawn points face into the arena. The layout uses 31 different source models, 18 building blocks, and 2,741 placed pieces, grouped into static neighborhood/material batches.

A schematic is served at `/maps/village-overview.svg` and linked from the lobby. In-game signs identify the central market and flank districts.

## Rendering and collision

The compiled GLB is approximately **30.1 MB**, delivered as **7.55 MB gzip**. Its 21 embedded textures are capped at 1024 pixels. Static geometry is grouped into 381 spatial/material batches for view culling. Village environment shadows update when the map or quality setting changes; they do not require a full static-map shadow pass every frame. Subzero keeps its existing rendering behavior.

Collision uses a continuous floor, triangle geometry for doorways, arches, accessible walls and cover, façade-aligned volumes for closed buildings, and convex roof envelopes. Roof envelopes avoid testing individual decorative roof tiles. Visible stairs use smooth ramp collision with solid sides and platform rails. Vegetation is decorative; its planters provide solid cover. The optimized collision mesh has 55,680 triangles, down from 253,194 before roof simplification.

The map loader replaces and disposes the previous map's meshes, materials and textures. Each switch has a version number, so late loading responses and outdated ready messages cannot start the wrong map. Failed downloads offer a retry button. Players joining an active round remain protected while their map loads.

## Source and rebuilding

The ZIP's bundled license identifies the pack as **CC0 1.0**. Its license text is retained at `public/maps/village-license.txt`, and the map credits Quaternius. The original ZIP remains in Downloads.

```sh
node scripts/build-village.mjs "/path/to/Medieval Village MegaKit[Standard].zip"
```

The offline compiler requires the project dependencies plus Python 3 and Pillow. Production startup only needs Node and the checked-in game assets. `public/maps/village-report.json` records build dimensions, placements and asset sizes.

## Verification

`node tests/village.cjs` checks the footprint, all 16 spawn volumes, stable gravity, blocking cover, central arch, both stairways and rails, both interior entrances, ceiling collision, connected spawn approaches, file integrity, and retained license. The navigation audit samples player-sized ground-level cells; it is deliberately conservative around narrow doorways.

`node tests/network.cjs` checks host-only map changes, stale ready-message rejection, the loading gate, compression, switching back to Subzero, round behavior and multiplayer state. `node tests/browser.cjs --village` loads the actual textures in Chrome, switches Bellhaven → Subzero → Bellhaven without reconnecting, starts a round, displays results, and captures the arena views under `tests/artifacts/`. Software-rendered headless Chrome is a functional/visual check, not a hardware FPS benchmark.

The weapon and movement upgrade remains in place; see `WEAPON-UPGRADE.md`.
