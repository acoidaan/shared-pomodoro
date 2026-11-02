const AVATAR_COLORS = [
  "#ff9f8f",
  "#f6c977",
  "#8fddb6",
  "#8dbcf5",
  "#b8a5f7",
  "#f3a7ca",
  "#7fd9d0",
  "#c5d889",
  "#efa58c",
];

export function avatarColor(name) {
  let h = 0;
  for (const c of name || "Usuario") {
    h = (h * 31 + c.charCodeAt(0)) >>> 0;
  }
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}
