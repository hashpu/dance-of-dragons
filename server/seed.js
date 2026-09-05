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
    locked: true, password: "sunspear", members: [] }
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

module.exports = { seed, HOUSES };

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
