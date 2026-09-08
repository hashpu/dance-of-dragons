/* Applications are submitted to this site's own backend (see server/routes/applications.js),
   which saves them to the database and optionally forwards them to Discord via a webhook —
   configure those webhook URLs server-side in server/.env, never here. Keep the `key`, `name`,
   `color`, and `questions` (id/required) below in sync with server/departments.js. */

const DEPARTMENTS = [
  {
    key: "developer",
    name: "Developer / Scripter",
    color: "#5b9bd5",
    icon: "wrench",
    blurb: "Build and script the systems that power the game: combat, UI, tools, and more.",
    questions: [
      { id: "experience", label: "Scripting experience: languages/tools, how long, notable projects", type: "textarea", required: true, section: "Background" },
      { id: "portfolio", label: "Portfolio / GitHub / example script link", type: "text", placeholder: "https://...", required: false, section: "Background" },
      { id: "languages", label: "Which languages and tools are you comfortable with? (Lua/Luau, Roblox Studio, Git, etc.)", type: "text", required: true, section: "Technical" },
      { id: "debugScenario", label: "A script is causing lag for players in a busy server. How would you go about diagnosing and fixing it?", type: "textarea", required: true, section: "Technical" }
    ]
  },
  {
    key: "warfare",
    name: "Warfare Department",
    color: "#e0483e",
    icon: "sword",
    blurb: "Plan and run large-scale in-game battles and events, and help balance combat systems.",
    questions: [
      { id: "experience", label: "Experience hosting or leading large in-game battles/events", type: "textarea", required: true, section: "Background" },
      { id: "combatKnowledge", label: "Your understanding of the group's combat or military systems", type: "textarea", required: true, section: "Background" },
      { id: "battleDesign", label: "How would you design a large-scale battle event so it stays fair and fun for both sides?", type: "textarea", required: true, section: "Combat Design" },
      { id: "disputeHandling", label: "A player disputes a battle's outcome, claiming they were killed unfairly. How do you handle it?", type: "textarea", required: true, section: "Combat Design" }
    ]
  },
  {
    key: "lore",
    name: "Lore Department",
    color: "#b08d57",
    icon: "quill",
    blurb: "Research and write the in-universe history, houses, and storylines that give the game its world.",
    questions: [
      { id: "experience", label: "What prior experience do you have with lore writing or worldbuilding?", type: "textarea", required: true, section: "Background" },
      { id: "readBooks", label: "Have you read the A Song of Ice and Fire novels? If so, which ones?", type: "text", required: true, section: "Background" },
      { id: "viserysQuestion", label: "Why did King Viserys I name Rhaenyra his heir, and why did that choice remain so contested even after he had sons?", type: "textarea", required: true, section: "Lore Knowledge" },
      { id: "dorneQuestion", label: "Why was Dorne able to resist Aegon's Conquest when the other six kingdoms could not?", type: "textarea", required: true, section: "Lore Knowledge" },
      { id: "northQuestion", label: "Why does the North's involvement in the realm's wars matter so much, despite its distance from King's Landing?", type: "textarea", required: true, section: "Lore Knowledge" },
      { id: "acDescription", label: "Pick any year \"AC\" in Westerosi history and briefly describe what happened.", type: "textarea", required: true, section: "Lore Knowledge" },
      { id: "creativeStory", label: "Write a short creative piece (a few paragraphs) set in the world of A Song of Ice and Fire.", type: "textarea", required: true, section: "Creative Writing" }
    ]
  },
  {
    key: "regional",
    name: "Regional Department",
    color: "#2dd4a7",
    icon: "globe",
    blurb: "Represent and grow the community across different regions and languages.",
    questions: [
      { id: "regionLang", label: "Region & languages you speak", type: "text", required: true, section: "Background" },
      { id: "experience", label: "Experience managing a regional community or server", type: "textarea", required: true, section: "Background" },
      { id: "growthPlan", label: "One of your assigned regions has gone quiet. What would you do to re-engage it?", type: "textarea", required: true, section: "Growing the Region" },
      { id: "conflict", label: "How would you resolve a disagreement between two active members from your region?", type: "textarea", required: true, section: "Growing the Region" }
    ]
  },
  {
    key: "media",
    name: "Media Department",
    color: "#e0622f",
    icon: "camera",
    blurb: "Create thumbnails, trailers, GFX, and other visual content for the group.",
    questions: [
      { id: "software", label: "Software you use (Blender, Photoshop, Premiere, etc.)", type: "text", required: true, section: "Background" },
      { id: "portfolio", label: "Portfolio / example work link", type: "text", placeholder: "https://...", required: true, section: "Background" },
      { id: "process", label: "Walk through how you'd approach making a thumbnail or trailer meant to grab attention fast.", type: "textarea", required: true, section: "Creative Process" }
    ]
  },
  {
    key: "moderation",
    name: "Moderation Department",
    color: "#4a90d9",
    icon: "shield",
    blurb: "Keep the community safe and the rules enforced across our servers and game.",
    questions: [
      { id: "modExperience", label: "Prior moderation experience (Discord/Roblox/other)", type: "textarea", required: true, section: "Background" },
      { id: "scenario", label: "How would you handle a member breaking rules but claiming it was a joke?", type: "textarea", required: true, section: "Judgment Calls" },
      { id: "friendScenario", label: "A close friend of yours breaks a rule. How do you handle it?", type: "textarea", required: true, section: "Judgment Calls" },
      { id: "disagreement", label: "You disagree with another moderator's decision, made publicly. What do you do?", type: "textarea", required: true, section: "Judgment Calls" }
    ]
  },
  {
    key: "community",
    name: "Community Engagement Department",
    color: "#d4af37",
    icon: "megaphone",
    blurb: "Plan events, contests, and initiatives that keep the community active and welcoming.",
    questions: [
      { id: "eventExperience", label: "Experience organizing events or contests", type: "textarea", required: false, section: "Background" },
      { id: "ideas", label: "Ideas for community events or initiatives", type: "textarea", required: true, section: "Ideas" },
      { id: "reengage", label: "How would you re-engage a community that's gone quiet?", type: "textarea", required: true, section: "Ideas" }
    ]
  },
  {
    key: "afl",
    name: "AFL Team",
    color: "#8b8bf5",
    icon: "star",
    blurb: "Join the AFL team and help support its day-to-day operations.",
    questions: [
      { id: "experience", label: "Relevant experience for this team", type: "textarea", required: true, section: "Background" },
      { id: "motivation", label: "What interests you about the AFL Team specifically?", type: "textarea", required: true, section: "Background" },
      { id: "commitment", label: "How many hours per week can you commit to AFL Team activities?", type: "text", required: true, section: "Background" }
    ]
  }
];
