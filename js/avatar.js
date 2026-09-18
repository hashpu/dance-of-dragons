/* Generates a small inline-SVG data URI avatar from just a name, so member
   cards look good even with no photo URL and no network. Always the site's
   one grey accent — this used to take a per-house color, but the site is
   grey-only now, and a data: URI image can't see the host page's CSS
   variables anyway (it's an isolated document), so this has to be a real
   hex value, not var(--red). Keep it in sync with --red in css/style.css. */
const AVATAR_FALLBACK_COLOR = "#b0b0b5";

function initialsOf(name) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

function generatedAvatar(name) {
  const initials = initialsOf(name || "?");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80">
    <rect width="80" height="80" rx="40" fill="${AVATAR_FALLBACK_COLOR}" opacity="0.25"/>
    <text x="50%" y="53%" text-anchor="middle" dominant-baseline="middle"
      font-family="Cinzel, serif" font-size="28" fill="${AVATAR_FALLBACK_COLOR}" font-weight="700">${initials}</text>
  </svg>`;
  return "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svg)));
}
