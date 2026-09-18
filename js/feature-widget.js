/* The "How It Works" landing-page widget: three tabs (Profile/Roles/
   Applications) that swap a preview card plus a heading/description below
   it. Static mock content only, illustrating real features. */
const FEATURE_WIDGET_CONTENT = {
  profile: {
    eyebrow: "Signed In, Everywhere",
    heading: "Your Discord Roles, Right On Your Profile",
    desc: "Sign in once and every house you visit already knows who you are: your server roles, your Roblox link, all of it, right in the profile card up top."
  },
  roles: {
    eyebrow: "Pulled In Automatically",
    heading: "Every Server Role, Right Here",
    desc: "The moment you sign in, your actual Discord roles show up on your profile card, no manual entry, no admin needing to update it by hand."
  },
  applications: {
    eyebrow: "No More Asking Around",
    heading: "Track Every Application You Send",
    desc: "Apply to a department once and hear back right here, approved, declined, or messaged directly by a recruiter."
  }
};

(function () {
  const tabsEl = document.getElementById("featureWidgetTabs");
  if (!tabsEl) return;

  const tabs = Array.from(tabsEl.querySelectorAll(".feature-widget-tab"));
  const panels = Array.from(document.querySelectorAll(".feature-widget-preview[data-panel]"));
  const eyebrowEl = document.getElementById("featureWidgetEyebrow");
  const headingEl = document.getElementById("featureWidgetHeading");
  const descEl = document.getElementById("featureWidgetDesc");

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const key = tab.dataset.tab;
      const content = FEATURE_WIDGET_CONTENT[key];
      if (!content) return;

      tabs.forEach((t) => {
        t.classList.toggle("active", t === tab);
        t.setAttribute("aria-selected", String(t === tab));
      });
      panels.forEach((p) => (p.hidden = p.dataset.panel !== key));

      eyebrowEl.textContent = content.eyebrow;
      headingEl.textContent = content.heading;
      descEl.textContent = content.desc;
    });
  });
})();
