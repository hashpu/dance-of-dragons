/* Server-side mirror of js/apply-data.js — keep the `key`, `name`, `color`,
   and `questions` (id/required) in sync with that file. This copy is what
   the API actually validates against and uses to build the Discord embed;
   the frontend copy is only for rendering the form. */
const DEPARTMENTS = [
  { key: "developer", name: "Developer / Scripter", color: "#5b9bd5",
    questions: [{ id: "experience", label: "Scripting experience: languages/tools, how long, notable projects", required: true },
                { id: "portfolio", label: "Portfolio / GitHub / example script link", required: false }] },
  { key: "warfare", name: "Warfare Department", color: "#e0483e",
    questions: [{ id: "experience", label: "Experience hosting or leading large in-game battles/events", required: true },
                { id: "combatKnowledge", label: "Your understanding of the group's combat or military systems", required: true }] },
  { key: "lore", name: "Lore Department", color: "#b08d57",
    questions: [{ id: "discordId", label: "Discord user ID (right-click your name in Discord, Copy User ID; enable Developer Mode if you don't see that option)", required: true },
                { id: "robloxProfile", label: "Roblox profile link or numeric user ID", required: true },
                { id: "experience", label: "What prior experience do you have with lore writing or worldbuilding?", required: true },
                { id: "readBooks", label: "Have you read the A Song of Ice and Fire novels? If so, which ones?", required: true },
                { id: "viserysQuestion", label: "Why did King Viserys I name Rhaenyra his heir, and why did that choice remain so contested even after he had sons?", required: true },
                { id: "dorneQuestion", label: "Why was Dorne able to resist Aegon's Conquest when the other six kingdoms could not?", required: true },
                { id: "northQuestion", label: "Why does the North's involvement in the realm's wars matter so much, despite its distance from King's Landing?", required: true },
                { id: "acDescription", label: "Pick any year \"AC\" in Westerosi history and briefly describe what happened.", required: true },
                { id: "creativeStory", label: "Write a short creative piece (a few paragraphs) set in the world of A Song of Ice and Fire.", required: true }] },
  { key: "regional", name: "Regional Department", color: "#2dd4a7",
    questions: [{ id: "regionLang", label: "Region & languages you speak", required: true },
                { id: "experience", label: "Experience managing a regional community or server", required: true }] },
  { key: "media", name: "Media Department", color: "#e0622f",
    questions: [{ id: "software", label: "Software you use (Blender, Photoshop, Premiere, etc.)", required: true },
                { id: "portfolio", label: "Portfolio / example work link", required: true }] },
  { key: "moderation", name: "Moderation Department", color: "#4a90d9",
    questions: [{ id: "modExperience", label: "Prior moderation experience (Discord/Roblox/other)", required: true },
                { id: "scenario", label: "How would you handle a member breaking rules but claiming it was a joke?", required: true }] },
  { key: "community", name: "Community Engagement Department", color: "#d4af37",
    questions: [{ id: "ideas", label: "Ideas for community events or initiatives", required: true },
                { id: "eventExperience", label: "Experience organizing events or contests", required: false }] },
  { key: "afl", name: "AFL Team", color: "#8b8bf5",
    questions: [{ id: "experience", label: "Relevant experience for this team", required: true },
                { id: "motivation", label: "What interests you about the AFL Team specifically?", required: true }] }
];

function findDepartment(key) {
  return DEPARTMENTS.find((d) => d.key === key);
}

module.exports = { DEPARTMENTS, findDepartment };
