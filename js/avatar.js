/* Generates a small inline-SVG data URI avatar from a name + color,
   so member cards look good even with no photo URL and no network. */

function initialsOf(name) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

function generatedAvatar(name, color) {
  const initials = initialsOf(name || "?");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80">
    <rect width="80" height="80" rx="40" fill="${color}" opacity="0.25"/>
    <text x="50%" y="53%" text-anchor="middle" dominant-baseline="middle"
      font-family="Cinzel, serif" font-size="28" fill="${color}" font-weight="700">${initials}</text>
  </svg>`;
  return "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svg)));
}
