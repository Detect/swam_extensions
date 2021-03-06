# SWAM Mod Extensions
StarMash Mod Extensions

[View issues](https://github.com/Detect/swam_extensions/issues) | [Create new issue](https://github.com/Detect/swam_extensions/issues/new)

## Shield Timer for CTF v1.5

Install URL: `https://detect.github.io/swam_extensions/assets/shield_timer.js`

When player sees that the shield at enemy base is taken, it will automatically start a countdown timer to when the shield will spawn again. Countdown timer is displayed under the flags captured at the top. Shield Timer will also optionally send local player only message about direction and distance of randomly spawned shields near the player.

### Mod Settings

- Enable/disable sending local messages about spawned shields (default enabled)

### In-Game UI
- Pressing `n` key manually toggles (starts/stops) timer.

## Improved Shuffle for CTF v0.8 alpha

Install URL: `https://detect.github.io/swam_extensions/assets/shuffle.js`

After a CTF match ends and teams are shuffled, this will compare the number of blue vs red players. If player is on a team with more than two non-spectating players than the other team, a modal will pop up asking if the player wants to try and re-join the team with less players.

On re-join, if player successfully switched teams, a general chat message will be sent (ie. Switched to blue to balance teams. 10 blue vs 15 red).
