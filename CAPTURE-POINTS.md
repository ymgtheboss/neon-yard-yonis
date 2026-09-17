# Capture Points

The default mode is Blue vs Red Capture Points. The host can select Deathmatch in the lobby or choose the next round's mode on the results screen. Modes cannot change during a live round.

- A, B and C are active simultaneously. All three move to different, validated spawn-area locations every **60 seconds**. New locations start neutral; accumulated team scores remain.
- Stay within a zone's three-meter radius to capture it. A lone player needs **five seconds** from neutral; extra teammates accelerate capture up to 1.5×. Taking an enemy zone requires neutralizing it first.
- Each held zone earns **one team point per second**, even if its team leaves. If both teams enter, capture and scoring pause until only one team remains.
- Players behind solid walls, on a different floor, still loading, dead, or protected by a spawn shield cannot capture. Objective ownership and scores are calculated on the server.
- Teams are balanced at round start. Late joiners enter the smaller team. Friendly bullet and explosive damage are disabled; self-damage remains.
- The normal round timer applies. Higher team score wins; equal scores draw. Individual captures appear on the scoreboard. Selecting the next mode preserves the completed round's results.

The HUD displays scores, your team, zone ownership/progress and the relocation countdown. Ground rings and distance markers identify each objective. Both Subzero and Bellhaven are supported.

Validation: deterministic capture/contest/takeover/scoring and 60-second rotation tests, friendly-fire tests, actual multiplayer mode-authority/result-freezing checks, and Chrome gameplay/results rendering.
