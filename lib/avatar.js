const AVATAR_COLORS = [
  "#ff6347",
  "#f59e0b",
  "#4ade80",
  "#60a5fa",
  "#a78bfa",
  "#f472b6",
  "#2dd4bf",
];

export function avatarColor(name) {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}
