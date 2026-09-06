require("dotenv").config();
const bcrypt = require("bcrypt");
const { pool } = require("./db");

const HOUSES = [
  { slug: "targaryen", name: "Targaryen", faction: "ROYAL HOUSE", color: "#ff4d4d",
    tagline: "Fire and Blood",
    description: "The House of the Dragon, rulers of the Seven Kingdoms since Aegon's Conquest.",
    locked: true, password: "dracarys",
    members: [
      { id: "viserys-i", name: "Viserys I", role: "King", parentId: null },
      { id: "rhaenyra", name: "Rhaenyra", role: "Heir", parentId: "viserys-i" },
      { id: "aegon-ii", name: "Aegon II", role: "King", parentId: "viserys-i" },
      { id: "aemond", name: "Aemond", role: "Prince", parentId: "viserys-i" },
      { id: "jacaerys", name: "Jacaerys", role: "", parentId: "rhaenyra" }
    ] },
  { slug: "velaryon", name: "Velaryon", faction: "BLACK FACTION", color: "#2dd4a7",
    tagline: "The Old, the True, the Brave",
    description: "Lords of Driftmark and masters of its fleet, the oldest Valyrian house besides the Targaryens.",
    locked: true, password: "driftmark",
    members: [
      { id: "corlys", name: "Corlys Velaryon", role: "Lord", parentId: null },
      { id: "laenor", name: "Laenor", role: "", parentId: "corlys" },
      { id: "laena", name: "Laena", role: "", parentId: "corlys" }
    ] },
  { slug: "hightower", name: "Hightower", faction: "GREEN FACTION", color: "#f0a848",
    tagline: "We Light the Way",
    description: "Lords of Oldtown and keepers of the Hightower, staunch backers of Queen Alicent.",
    locked: true, password: "oldtown", members: [] },
  { slug: "strong", name: "Strong", faction: "LORDS OF HARRENHAL", color: "#b08d57",
    tagline: "Rise from the Ashes",
    description: "Lords of Harrenhal following the Dance, a Riverlands house with a controversial claim to the ruined castle.",
    locked: true, password: "harrenhal", members: [] },
  { slug: "stark", name: "Stark", faction: "BLACK FACTION", color: "#b8bfc7",
    tagline: "Winter Is Coming",
    description: "Wardens of the North and rulers of Winterfell, ancient guardians against what lies beyond the Wall.",
    locked: true, password: "winterfell", members: [] },
  { slug: "arryn", name: "Arryn", faction: "BLACK FACTION", color: "#5b9bd5",
    tagline: "As High as Honor",
    description: "Wardens of the East and rulers of the Vale from the Eyrie, guarded by the Mountains of the Moon.",
    locked: true, password: "eyrie", members: [] },
  { slug: "tully", name: "Tully", faction: "BLACK FACTION", color: "#4a90d9",
    tagline: "Family, Duty, Honor",
    description: "Lords of Riverrun and the Riverlands, they backed Rhaenyra's claim.",
    locked: true, password: "riverrun", members: [] },
  { slug: "baratheon", name: "Baratheon", faction: "GREEN FACTION", color: "#d9a441",
    tagline: "Ours is the Fury",
    description: "Lords of Storm's End, they backed Aegon II's claim.",
    locked: true, password: "stormsend", members: [] },
  { slug: "lannister", name: "Lannister", faction: "GREEN FACTION", color: "#d4af37",
    tagline: "Hear Me Roar",
    description: "Wardens of the West and rulers of Casterly Rock, they backed Aegon II's claim.",
    locked: true, password: "casterlyrock", members: [] },
  { slug: "martell", name: "Martell", faction: "NEUTRAL", color: "#e0622f",
    tagline: "Unbowed, Unbent, Unbroken",
    description: "Rulers of Dorne, they stayed neutral through most of the Dance of the Dragons.",
    locked: true, password: "sunspear", members: [] },
  { slug: "greyjoy", name: "Greyjoy", faction: "NEUTRAL", color: "#4a5a52",
    tagline: "We Do Not Sow",
    description: "Lords of the Iron Islands and reavers of the western coasts, more concerned with plunder than either side of the Dance.",
    locked: true, password: "ironborn", members: [] },
  { slug: "tyrell", name: "Tyrell", faction: "NEUTRAL", color: "#6fae4a",
    tagline: "Growing Strong",
    description: "Lords of Highgarden and wardens of the Reach, they kept much of their strength out of the Dance.",
    locked: true, password: "highgarden", members: [] },
  { slug: "blackwood", name: "Blackwood", faction: "BLACK FACTION", color: "#5a5a63",
    tagline: "None So Wise",
    description: "Lords of Raventree Hall in the Riverlands, ancient rivals of House Bracken, who backed Rhaenyra's claim.",
    locked: true, password: "raventree", members: [] },
  { slug: "bracken", name: "Bracken", faction: "GREEN FACTION", color: "#a83232",
    tagline: "We Serve",
    description: "Lords of Stone Hedge and blood rivals of House Blackwood, whose old feud put them on opposite sides of the Dance.",
    locked: true, password: "stonehedge", members: [] },
  { slug: "dayne", name: "Dayne", faction: "NEUTRAL", color: "#7a5ba6",
    tagline: "Sword of the Morning",
    description: "Lords of Starfall in Dorne, keepers of the ancestral blade Dawn, untouched by the Dance.",
    locked: true, password: "starfall", members: [] },
  { slug: "beesbury", name: "Beesbury", faction: "BLACK FACTION", color: "#d1a13a",
    tagline: "Beware Our Sting",
    description: "Lords of Honeyholt in the Reach, one of whom served as Rhaenyra's Lord Treasurer.",
    locked: true, password: "honeyholt", members: [] },
  { slug: "frey", name: "Frey", faction: "BLACK FACTION", color: "#4a4a52",
    tagline: "We Stand Together",
    description: "Lords of the Twins, who held the crossing of the Green Fork and backed Rhaenyra's claim.",
    locked: true, password: "thetwins", members: [] },
  { slug: "royce", name: "Royce", faction: "BLACK FACTION", color: "#7d8a99",
    tagline: "We Remember",
    description: "Lords of Runestone in the Vale, bannermen to House Arryn.",
    locked: true, password: "runestone", members: [] },
  { slug: "manderly", name: "Manderly", faction: "BLACK FACTION", color: "#2e7d6e",
    tagline: "Strength and Courtesy",
    description: "Lords of White Harbor in the North, wealthy and loyal bannermen of House Stark.",
    locked: true, password: "whiteharbor", members: [] },
  { slug: "celtigar", name: "Celtigar", faction: "BLACK FACTION", color: "#b5442e",
    tagline: "Bright as Fire, Strong as Iron",
    description: "Lords of Claw Isle in the Crownlands, among the first to declare for Rhaenyra.",
    locked: true, password: "clawisle", members: [] },
  { slug: "mormont", name: "Mormont", faction: "BLACK FACTION", color: "#3d5c3a",
    tagline: "Here We Stand",
    description: "Lords of Bear Island in the North, fierce and few, sworn to House Stark.",
    locked: true, password: "bearisland", members: [] },
  { slug: "redwyne", name: "Redwyne", faction: "GREEN FACTION", color: "#7a2e4a",
    tagline: "Bound by Honor",
    description: "Lords of the Arbor and masters of the Reach's fleet, who backed Aegon II's claim.",
    locked: true, password: "thearbor", members: [] },
  { slug: "belaerys", name: "Belaerys", faction: "NEUTRAL", color: "#4a3f8f",
    tagline: "Blood of Old Valyria",
    description: "A minor house said to carry old Valyrian blood, their true origins lost to the Doom.",
    locked: true, password: "oldvalyria", members: [] },
  { slug: "kingsguard", name: "Kingsguard", faction: "CROWN", color: "#e6e2d2",
    tagline: "And I Shall Know No Fear",
    description: "The seven sworn shields of the king, bound for life to protect the royal family above all else.",
    locked: true, password: "whitecloak",
    members: [
      { id: "criston-cole", name: "Criston Cole", role: "Lord Commander", parentId: null },
      { id: "harrold-westerling", name: "Harrold Westerling", role: "Ser", parentId: null }
    ] },
  { slug: "dragonguard", name: "Dragonguard", faction: "CROWN", color: "#c9622d",
    tagline: "Blood of the Dragon, Guard of the Skies",
    description: "An elite order once sworn to guard the Targaryen dragonriders themselves, its ranks scattered during the Dance.",
    locked: true, password: "skyguard", members: [] },
  { slug: "faith-militant", name: "Faith Militant", faction: "CROWN", color: "#9c7a3f",
    tagline: "The Seven Protect",
    description: "The Warrior's Sons and Poor Fellows, the martial arm of the Faith of the Seven, sworn to defend the realm's faithful.",
    locked: true, password: "sevenpointed", members: [] },
  { slug: "city-watch", name: "City Watch", faction: "CROWN", color: "#c9a227",
    tagline: "Keepers of King's Landing",
    description: "The gold-cloaked men who patrol King's Landing's streets and gates, keeping the king's peace.",
    locked: true, password: "goldcloak", members: [] }
];

async function seed(pool) {
  await pool.query("DELETE FROM houses"); // cascades to members via the FK

  for (let i = 0; i < HOUSES.length; i++) {
    const h = HOUSES[i];
    const passwordHash = h.password ? await bcrypt.hash(h.password, 10) : null;
    await pool.query(
      `INSERT INTO houses (slug, name, faction, color, tagline, description, locked, password_hash, order_index)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [h.slug, h.name, h.faction, h.color, h.tagline, h.description, h.locked, passwordHash, i]
    );
    for (const m of h.members) {
      await pool.query(
        `INSERT INTO members (id, house_slug, parent_id, name, role)
         VALUES ($1,$2,$3,$4,$5)`,
        [m.id, h.slug, m.parentId, m.name, m.role || ""]
      );
    }
  }
}

// Adds any house from HOUSES that isn't already in the database, and
// nothing else — never touches an existing house's row or its members.
// This is how new houses should get added to a live site: `seed` above
// wipes everything (including real visitors' family trees) and should
// only ever run on an admin's own explicit "reset everything" request.
async function seedMissingHouses(pool) {
  const existing = await pool.query("SELECT slug FROM houses");
  const existingSlugs = new Set(existing.rows.map((r) => r.slug));

  const orderRes = await pool.query("SELECT COALESCE(MAX(order_index), -1) AS max_order FROM houses");
  let nextOrder = Number(orderRes.rows[0].max_order) + 1;

  const added = [];
  for (const h of HOUSES) {
    if (existingSlugs.has(h.slug)) continue;

    const passwordHash = h.password ? await bcrypt.hash(h.password, 10) : null;
    await pool.query(
      `INSERT INTO houses (slug, name, faction, color, tagline, description, locked, password_hash, order_index)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [h.slug, h.name, h.faction, h.color, h.tagline, h.description, h.locked, passwordHash, nextOrder++]
    );
    for (const m of h.members) {
      await pool.query(
        `INSERT INTO members (id, house_slug, parent_id, name, role)
         VALUES ($1,$2,$3,$4,$5)`,
        [m.id, h.slug, m.parentId, m.name, m.role || ""]
      );
    }
    added.push(h.slug);
  }
  return added;
}

module.exports = { seed, seedMissingHouses, HOUSES };

if (require.main === module) {
  seed(pool)
    .then(() => {
      console.log("Seeded database with default lore.");
      return pool.end();
    })
    .catch((err) => {
      console.error("Seed failed:", err);
      process.exit(1);
    });
}
