# SWAM Mod Extensions
StarMash Mod Extensions

## Shield Timer for CTF (beta)

Install URL: `https://detect.github.io/swam_extensions/assets/shield_timer.js`

When player sees that the shield at enemy base is taken, it will automatically start a countdown timer to when the shield will spawn again. Countdown timer is displayed under the flags captured at the top. It can also send shield timer to team chat based on user settings.

### Mod Settings

- Enable/disable automatically sending timer to team chat (default enabled)
- Customize intervals (comma separated) in seconds to send timer to team chat (default 60, 30, 10)

### In-Game UI
- If auto-team chat setting is enabled, pressing `b` key will toggle (pause/resume) sending timer to team chat.
- If auto-team chat seeting is disabled, pressing `b` key will send current timer to team chat.

## Improved Shuffle for CTF (alpha)

Install URL: `https://detect.github.io/swam_extensions/assets/shuffle.js`

After a CTF match ends and teams are shuffled, this will compare the number of blue vs red players. If player is on a team with more than two non-spectating players than the other team, a modal will pop up asking if the player wants to try and re-join the team with less players.
