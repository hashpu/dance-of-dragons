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
    questions: [{ id: "familiarity", label: "Your familiarity with A Song of Ice and Fire / House of the Dragon lore", required: true },
                { id: "sample", label: "Writing sample: a few sentences describing a fictional minor house or character", required: true }] },
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
