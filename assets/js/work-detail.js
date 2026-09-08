(() => {
  const panels = Array.from(document.querySelectorAll("[data-project-panel]"));
  if (!panels.length) return;

  const ids = panels.map((panel) => panel.dataset.projectPanel);
  const requested = new URLSearchParams(window.location.search).get("project");
  const projectId = ids.includes(requested) ? requested : ids[0];
  const activeIndex = ids.indexOf(projectId);
  const active = panels[activeIndex];

  panels.forEach((panel) => {
    panel.hidden = panel !== active;
  });

  const setText = (selector, value) => {
    const element = document.querySelector(selector);
    if (element) element.textContent = value;
  };

  setText("[data-project-category]", active.dataset.category);
  setText("[data-project-title]", active.dataset.title);
  setText("[data-project-summary]", active.dataset.summary);
  setText("[data-project-role]", active.dataset.role);
  setText("[data-project-period]", active.dataset.period);
  setText("[data-project-collab]", active.dataset.collab);
  setText("[data-project-tools]", active.dataset.tools);

  const cover = document.querySelector("[data-project-cover]");
  if (cover) {
    cover.src = active.dataset.cover;
    cover.alt = active.dataset.coverAlt;
    cover.width = Number(active.dataset.coverWidth) || 1200;
    cover.height = Number(active.dataset.coverHeight) || 1200;
  }

  document.title = `${active.dataset.title}｜Yuki · 作品与笔记`;
  const description = document.querySelector('meta[name="description"]');
  if (description) description.content = active.dataset.summary;

  const previousId = ids[(activeIndex - 1 + ids.length) % ids.length];
  const nextId = ids[(activeIndex + 1) % ids.length];
  const previous = document.querySelector("[data-project-prev]");
  const next = document.querySelector("[data-project-next]");
  if (previous) previous.href = `work-detail.html?project=${previousId}`;
  if (next) next.href = `work-detail.html?project=${nextId}`;
})();
