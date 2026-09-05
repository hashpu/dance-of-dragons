(function () {
  const EMBER_COUNT = 16;
  const field = document.createElement("div");
  field.className = "bg-fx";

  for (let i = 0; i < EMBER_COUNT; i++) {
    const ember = document.createElement("span");
    ember.className = "ember";

    const width = 3 + Math.random() * 3;
    const height = width * (1.3 + Math.random() * 0.4);
    const left = Math.random() * 100;
    const duration = 9 + Math.random() * 10;
    const delay = -Math.random() * duration;
    const drift = (Math.random() * 2 - 1) * 60;
    const flickerDuration = 0.45 + Math.random() * 0.4;
    const flickerDelay = -Math.random() * flickerDuration;

    ember.style.width = `${width}px`;
    ember.style.height = `${height}px`;
    ember.style.left = `${left}%`;
    ember.style.animationDuration = `${duration}s`;
    ember.style.animationDelay = `${delay}s`;
    ember.style.setProperty("--drift", `${drift}px`);

    const flame = document.createElement("i");
    flame.className = "ember-flame";
    flame.style.animationDuration = `${flickerDuration}s`;
    flame.style.animationDelay = `${flickerDelay}s`;
    ember.appendChild(flame);

    field.appendChild(ember);
  }

  document.body.prepend(field);
})();
