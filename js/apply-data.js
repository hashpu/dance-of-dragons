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
    blurb: "Build and script the systems that power the game — combat, UI, tools, and more.",
    questions: [
      { id: "experience", label: "Scripting experience — languages/tools, how long, notable projects", type: "textarea", required: true },
      { id: "portfolio", label: "Portfolio / GitHub / example script link", type: "text", placeholder: "https://...", required: false }
    ]
  },
  {
    key: "warfare",
    name: "Warfare Department",
    color: "#e0483e",
    icon: "sword",
    blurb: "Plan and run large-scale in-game battles and events, and help balance combat systems.",
    questions: [
      { id: "experience", label: "Experience hosting or leading large in-game battles/events", type: "textarea", required: true },
      { id: "combatKnowledge", label: "Your understanding of the group's combat or military systems", type: "textarea", required: true }
    ]
  },
  {
    key: "lore",
    name: "Lore Department",
    color: "#b08d57",
    icon: "quill",
    blurb: "Research and write the in-universe history, houses, and storylines that give the game its world.",
    questions: [
      { id: "familiarity", label: "Your familiarity with A Song of Ice and Fire / House of the Dragon lore", type: "textarea", required: true },
      { id: "sample", label: "Writing sample — a few sentences describing a fictional minor house or character", type: "textarea", required: true }
    ]
  },
  {
    key: "regional",
    name: "Regional Department",
    color: "#2dd4a7",
    icon: "globe",
    blurb: "Represent and grow the community across different regions and languages.",
    questions: [
      { id: "regionLang", label: "Region & languages you speak", type: "text", required: true },
      { id: "experience", label: "Experience managing a regional community or server", type: "textarea", required: true }
    ]
  },
  {
    key: "media",
    name: "Media Department",
    color: "#e0622f",
    icon: "camera",
    blurb: "Create thumbnails, trailers, GFX, and other visual content for the group.",
    questions: [
      { id: "software", label: "Software you use (Blender, Photoshop, Premiere, etc.)", type: "text", required: true },
      { id: "portfolio", label: "Portfolio / example work link", type: "text", placeholder: "https://...", required: true }
    ]
  },
  {
    key: "moderation",
    name: "Moderation Department",
    color: "#4a90d9",
    icon: "shield",
    blurb: "Keep the community safe and the rules enforced across our servers and game.",
    questions: [
      { id: "modExperience", label: "Prior moderation experience (Discord/Roblox/other)", type: "textarea", required: true },
      { id: "scenario", label: "How would you handle a member breaking rules but claiming it was a joke?", type: "textarea", required: true }
    ]
  },
  {
    key: "community",
    name: "Community Engagement Department",
    color: "#d4af37",
    icon: "megaphone",
    blurb: "Plan events, contests, and initiatives that keep the community active and welcoming.",
    questions: [
      { id: "ideas", label: "Ideas for community events or initiatives", type: "textarea", required: true },
      { id: "eventExperience", label: "Experience organizing events or contests", type: "textarea", required: false }
    ]
  },
  {
    key: "afl",
    name: "AFL Team",
    color: "#8b8bf5",
    icon: "star",
    blurb: "Join the AFL team and help support its day-to-day operations.",
    questions: [
      { id: "experience", label: "Relevant experience for this team", type: "textarea", required: true },
      { id: "motivation", label: "What interests you about the AFL Team specifically?", type: "textarea", required: true }
    ]
  }
];
