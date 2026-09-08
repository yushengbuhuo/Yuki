(function () {
  "use strict";
  document.querySelectorAll("[data-filter-group]").forEach((group) => {
    const targetName = group.dataset.filterGroup;
    const items = Array.from(document.querySelectorAll(`[data-filter-item="${targetName}"]`));
    const status = document.querySelector(`[data-filter-status="${targetName}"]`);
    const buttons = Array.from(group.querySelectorAll("button[data-filter]"));
    const validFilters = new Set(buttons.map((button) => button.dataset.filter));

    const filterFromUrl = () => {
      if (targetName !== "works") return "all";
      const requested = new URLSearchParams(window.location.search).get("filter") || "all";
      return validFilters.has(requested) ? requested : "all";
    };

    const applyFilter = (filter, options = {}) => {
      const safeFilter = validFilters.has(filter) ? filter : "all";
      buttons.forEach((candidate) => {
        candidate.setAttribute("aria-pressed", String(candidate.dataset.filter === safeFilter));
      });
      let visible = 0;
      items.forEach((item) => {
        const matches = safeFilter === "all" || item.dataset.category === safeFilter;
        item.hidden = !matches;
        if (matches) visible += 1;
      });
      if (status) status.textContent = `已显示 ${visible} 项`;

      if (options.updateUrl && targetName === "works") {
        const url = new URL(window.location.href);
        if (safeFilter === "all") url.searchParams.delete("filter");
        else url.searchParams.set("filter", safeFilter);
        url.hash = "";
        window.history.pushState({ filter: safeFilter }, "", url);
      }
      group.dispatchEvent(new CustomEvent("filterchange", { detail: { filter: safeFilter, visible } }));
    };

    group.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-filter]");
      if (!button) return;
      applyFilter(button.dataset.filter, { updateUrl: true });
    });

    if (targetName === "works") {
      window.addEventListener("popstate", () => applyFilter(filterFromUrl()));
    }
    applyFilter(filterFromUrl());
  });
})();
