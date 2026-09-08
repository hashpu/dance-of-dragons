/* Server-side mirror of js/apply-data.js — keep the `key`, `name`, `color`,
   and `questions` (id/required) in sync with that file. This copy is what
   the API actually validates against and uses to build the Discord embed;
   the frontend copy is only for rendering the form. */
const DEPARTMENTS = [
  { key: "developer", name: "Developer / Scripter", color: "#5b9bd5",
    questions: [{ id: "experience", label: "Scripting experience: languages/tools, how long, notable projects", required: true },
                { id: "portfolio", label: "Portfolio / GitHub / example script link", required: false },
                { id: "languages", label: "Which languages and tools are you comfortable with? (Lua/Luau, Roblox Studio, Git, etc.)", required: true },
                { id: "debugScenario", label: "A script is causing lag for players in a busy server. How would you go about diagnosing and fixing it?", required: true }] },
  { key: "warfare", name: "Warfare Department", color: "#e0483e",
    questions: [{ id: "experience", label: "Experience hosting or leading large in-game battles/events", required: true },
                { id: "combatKnowledge", label: "Your understanding of the group's combat or military systems", required: true },
                { id: "battleDesign", label: "How would you design a large-scale battle event so it stays fair and fun for both sides?", required: true },
                { id: "disputeHandling", label: "A player disputes a battle's outcome, claiming they were killed unfairly. How do you handle it?", required: true }] },
  { key: "lore", name: "Lore Department", color: "#b08d57",
    questions: [{ id: "experience", label: "What prior experience do you have with lore writing or worldbuilding?", required: true },
                { id: "readBooks", label: "Have you read the A Song of Ice and Fire novels? If so, which ones?", required: true },
                { id: "viserysQuestion", label: "Why did King Viserys I name Rhaenyra his heir, and why did that choice remain so contested even after he had sons?", required: true },
                { id: "dorneQuestion", label: "Why was Dorne able to resist Aegon's Conquest when the other six kingdoms could not?", required: true },
                { id: "northQuestion", label: "Why does the North's involvement in the realm's wars matter so much, despite its distance from King's Landing?", required: true },
                { id: "acDescription", label: "Pick any year \"AC\" in Westerosi history and briefly describe what happened.", required: true },
                { id: "creativeStory", label: "Write a short creative piece (a few paragraphs) set in the world of A Song of Ice and Fire.", required: true }] },
  { key: "regional", name: "Regional Department", color: "#2dd4a7",
    questions: [{ id: "regionLang", label: "Region & languages you speak", required: true },
                { id: "experience", label: "Experience managing a regional community or server", required: true },
                { id: "growthPlan", label: "One of your assigned regions has gone quiet. What would you do to re-engage it?", required: true },
                { id: "conflict", label: "How would you resolve a disagreement between two active members from your region?", required: true }] },
  { key: "media", name: "Media Department", color: "#e0622f",
    questions: [{ id: "software", label: "Software you use (Blender, Photoshop, Premiere, etc.)", required: true },
                { id: "portfolio", label: "Portfolio / example work link", required: true },
                { id: "process", label: "Walk through how you'd approach making a thumbnail or trailer meant to grab attention fast.", required: true }] },
  { key: "moderation", name: "Moderation Department", color: "#4a90d9",
    questions: [{ id: "modExperience", label: "Prior moderation experience (Discord/Roblox/other)", required: true },
                { id: "scenario", label: "How would you handle a member breaking rules but claiming it was a joke?", required: true },
                { id: "friendScenario", label: "A close friend of yours breaks a rule. How do you handle it?", required: true },
                { id: "disagreement", label: "You disagree with another moderator's decision, made publicly. What do you do?", required: true }] },
  { key: "community", name: "Community Engagement Department", color: "#d4af37",
    questions: [{ id: "eventExperience", label: "Experience organizing events or contests", required: false },
                { id: "ideas", label: "Ideas for community events or initiatives", required: true },
                { id: "reengage", label: "How would you re-engage a community that's gone quiet?", required: true }] },
  { key: "afl", name: "AFL Team", color: "#8b8bf5",
    questions: [{ id: "experience", label: "Experience with sales, marketing, or running a shop/storefront (in Roblox or elsewhere)", required: true },
                { id: "motivation", label: "What interests you about running the AFL Team's shop specifically?", required: true },
                { id: "pricingScenario", label: "A new item isn't selling well. How would you reprice or promote it to turn that around?", required: true },
                { id: "commitment", label: "How many hours per week can you commit to AFL Team activities?", required: true }] }
];

function findDepartment(key) {
  return DEPARTMENTS.find((d) => d.key === key);
}

module.exports = { DEPARTMENTS, findDepartment };
