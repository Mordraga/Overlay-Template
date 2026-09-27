// Twitch credentials for the stats strip in layout.html.
// Copy this file to twitch-config.js (same folder) and fill it in.
// twitch-config.js is in .gitignore — it never gets committed. Keep it private.
//
// Token needs scopes: channel:read:goals moderator:read:followers
// Get one from a Twitch app (dev.twitch.tv/console) with redirect URL http://localhost:
//   https://id.twitch.tv/oauth2/authorize?response_type=token&client_id=YOUR_CLIENT_ID&redirect_uri=http://localhost&scope=channel:read:goals+moderator:read:followers
// When the goal bars say "Token expired", generate a new token and paste it into twitch-config.js.

window.TWITCH_CONFIG = {
  clientId: '',
  token: ''
};
