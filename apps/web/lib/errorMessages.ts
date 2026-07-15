const ERROR_MESSAGES: Record<string, string> = {
  room_not_found: "That room does not exist or has already closed.",
  room_exists: "A room with that code already exists.",
  room_full: "This room is full. Try spectating instead.",
  game_in_progress: "The game has already started. You can watch as a spectator.",
  slot_taken: "Someone else is already using that seat from another device.",
  wrong_password: "Incorrect room password.",
  not_host: "Only the host can do that.",
  not_in_room: "You are not in this room.",
  not_all_ready: "Everyone must be ready before the host can start.",
  not_enough_players: "At least 2 players are needed to start.",
  cannot_kick_self: "You cannot remove yourself — leave the room instead.",
  cannot_kick_current_player: "You cannot remove the player whose turn it is.",
  cannot_leave: "You cannot leave during an active round with money in the pot.",
  rate_limited: "Slow down — you are sending actions too quickly.",
  invalid_name: "Please choose a different display name.",
  inappropriate_name: "That name is not allowed. Please choose something respectful.",
  invalid_message: "Message cannot be empty.",
  chat_muted: "Chat is muted for you in this room.",
  chat_muted_all: "The host has muted chat for this room.",
  player_banned: "You are banned from this room.",
  report_failed: "Could not submit your report. Try again.",
  ban_failed: "Could not ban that player.",
  already_host: "That player is already the host.",
  player_not_found: "Player not found in this room.",
  player_disconnected: "That player is disconnected right now.",
  invalid_session_token: "Could not reclaim your seat — rejoin from the lobby with your room code.",
  invalid_auth_token: "Your login session expired. Sign in again and retry.",
  join_failed: "Could not join the room.",
  create_failed: "Could not create the room.",
  bad_request: "Something went wrong. Please try again.",
};

export function formatSocketError(code?: string, fallback?: string): string {
  if (code && ERROR_MESSAGES[code]) return ERROR_MESSAGES[code];
  if (fallback && fallback.length > 0) return fallback;
  return ERROR_MESSAGES.bad_request;
}
