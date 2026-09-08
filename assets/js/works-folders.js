(() => {
  "use strict";

  const archive = document.querySelector(".work-showcase-list");
  if (!archive) return;

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const projects = Array.from(archive.querySelectorAll(".work-showcase"));
  const animations = new WeakMap();

  const animatePanel = (panel, expand, immediate = false) => {
    animations.get(panel)?.cancel();
    if (immediate || reduceMotion.matches || typeof panel.animate !== "function") {
      panel.hidden = !expand;
      panel.style.removeProperty("height");
      panel.style.removeProperty("opacity");
      return;
    }

    if (expand) panel.hidden = false;
    const startHeight = expand ? 0 : panel.getBoundingClientRect().height;
    const endHeight = expand ? panel.scrollHeight : 0;
    const animation = panel.animate([
      { height: `${startHeight}px`, opacity: expand ? 0 : 1 },
      { height: `${endHeight}px`, opacity: expand ? 1 : 0 }
    ], {
      duration: expand ? 380 : 280,
      easing: "cubic-bezier(.2,.75,.2,1)"
    });
    animations.set(panel, animation);
    animation.finished.then(() => {
      if (animations.get(panel) !== animation) return;
      panel.hidden = !expand;
      panel.style.removeProperty("height");
      panel.style.removeProperty("opacity");
      animations.delete(panel);
    }).catch(() => {});
  };

  const partFolders = new Map();

  const setPartExpanded = (part, expand, immediate = false) => {
    const entry = partFolders.get(part);
    if (!entry) return;
    part.classList.toggle("is-open", expand);
    entry.trigger.setAttribute("aria-expanded", String(expand));
    entry.trigger.setAttribute("aria-label", `${expand ? "收起" : "展开"}${entry.title}`);
    animatePanel(entry.content, expand, immediate);
  };

  projects.forEach((project, projectIndex) => {
    const header = project.querySelector(":scope > .work-showcase-header");
    if (!header) return;

    const title = header.querySelector("h2")?.textContent.trim() || `项目 ${projectIndex + 1}`;
    const body = document.createElement("div");
    body.className = "work-folder-body";
    body.id = `${project.id || `work-${projectIndex + 1}`}-folder`;
    const bodyInner = document.createElement("div");
    bodyInner.className = "work-folder-body-inner";
    while (header.nextSibling) bodyInner.append(header.nextSibling);
    body.append(bodyInner);
    project.append(body);

    const previewSources = [];
    const seenSources = new Set();
    body.querySelectorAll("img").forEach((source) => {
      const src = source.getAttribute("src");
      if (!src || seenSources.has(src) || previewSources.length >= 6) return;
      seenSources.add(src);
      previewSources.push({ src, alt: source.alt || title });
    });

    if (previewSources.length) {
      const preview = document.createElement("figure");
      preview.className = "work-folder-preview";
      preview.setAttribute("aria-label", `${title} 图片预览`);
      const track = document.createElement("div");
      track.className = "work-preview-track";
      const previewImages = previewSources.map((source, imageIndex) => {
        const image = document.createElement("img");
        image.src = source.src;
        image.alt = source.alt;
        image.loading = projectIndex < 2 && imageIndex === 0 ? "eager" : "lazy";
        image.decoding = "async";
        image.className = "work-preview-image";
        image.hidden = imageIndex !== 0;
        track.append(image);
        return image;
      });
      preview.append(track);

      if (previewImages.length > 1) {
        let previewIndex = 0;
        const status = document.createElement("span");
        status.className = "work-preview-status";
        status.setAttribute("aria-live", "polite");

        const updatePreview = (nextIndex, direction) => {
          previewIndex = (nextIndex + previewImages.length) % previewImages.length;
          preview.dataset.direction = direction;
          previewImages.forEach((image, imageIndex) => {
            const active = imageIndex === previewIndex;
            image.hidden = !active;
            image.classList.toggle("is-active", active);
          });
          status.textContent = `${previewIndex + 1} / ${previewImages.length}`;
        };

        const previous = document.createElement("button");
        previous.type = "button";
        previous.className = "work-preview-arrow work-preview-previous";
        previous.setAttribute("aria-label", `${title} 上一张图片`);
        previous.textContent = "←";

        const next = document.createElement("button");
        next.type = "button";
        next.className = "work-preview-arrow work-preview-next";
        next.setAttribute("aria-label", `${title} 下一张图片`);
        next.textContent = "→";

        previous.addEventListener("click", (event) => {
          event.stopPropagation();
          updatePreview(previewIndex - 1, "previous");
        });
        next.addEventListener("click", (event) => {
          event.stopPropagation();
          updatePreview(previewIndex + 1, "next");
        });
        preview.append(previous, next, status);
        updatePreview(0, "next");
      }
      header.prepend(preview);
    }

    const action = document.createElement("span");
    action.className = "work-folder-action";
    action.setAttribute("aria-hidden", "true");
    header.append(action);

    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "work-folder-trigger";
    trigger.setAttribute("aria-controls", body.id);
    trigger.setAttribute("aria-expanded", "false");
    trigger.setAttribute("aria-label", `展开作品：${title}`);
    header.append(trigger);
    header.querySelector(".work-folder-preview")?.addEventListener("click", (event) => {
      if (event.target.closest("button")) return;
      trigger.click();
    });

    project.classList.add("is-folder");
    body.hidden = true;

    body.querySelectorAll(".media-slider").forEach((part, partIndex) => {
      const heading = part.querySelector(":scope > .media-slider-heading");
      const partTitle = heading?.querySelector("h3")?.textContent.trim() || `作品内容 ${partIndex + 1}`;
      if (heading && !heading.querySelector("p, .gallery-slider-controls")) heading.classList.add("is-title-only");
      const content = document.createElement("div");
      content.className = "work-part-content";
      content.id = `${body.id}-part-${partIndex + 1}`;
      while (part.firstChild) content.append(part.firstChild);

      const partTrigger = document.createElement("button");
      partTrigger.type = "button";
      partTrigger.className = "work-part-trigger";
      partTrigger.setAttribute("aria-controls", content.id);
      partTrigger.innerHTML = `<span class="work-part-folder-icon" aria-hidden="true"></span><span class="work-part-label"><strong>${partTitle}</strong></span><span class="work-part-chevron" aria-hidden="true">⌄</span>`;
      part.prepend(partTrigger);
      part.append(content);
      part.classList.add("is-part-folder");
      partFolders.set(part, {
        trigger: partTrigger,
        content,
        title: partTitle
      });
      partTrigger.addEventListener("click", () => setPartExpanded(part, !part.classList.contains("is-open")));
      setPartExpanded(part, partIndex === 0, true);
    });

    project._folder = { body, trigger, action, title };
  });

  const setProjectExpanded = (project, expand, options = {}) => {
    const entry = project._folder;
    if (!entry) return;
    if (expand) {
      projects.forEach((other) => {
        if (other !== project && other.classList.contains("is-open")) {
          setProjectExpanded(other, false, { immediate: options.immediate, updateHash: false });
        }
      });
    }
    project.classList.toggle("is-open", expand);
    entry.trigger.setAttribute("aria-expanded", String(expand));
    entry.trigger.setAttribute("aria-label", `${expand ? "收起" : "展开"}作品：${entry.title}`);
    animatePanel(entry.body, expand, options.immediate);

    if (options.updateHash !== false) {
      const target = expand ? `#${project.id}` : `${window.location.pathname}${window.location.search}`;
      history.replaceState(null, "", target);
    }
    if (expand && options.scroll) {
      window.setTimeout(() => project.scrollIntoView({ behavior: reduceMotion.matches ? "auto" : "smooth", block: "start" }), 40);
    }
  };

  projects.forEach((project) => {
    project._folder?.trigger.addEventListener("click", () => {
      const willExpand = !project.classList.contains("is-open");
      setProjectExpanded(project, willExpand, { scroll: willExpand });
    });
  });

  document.querySelector('[data-filter-group="works"]')?.addEventListener("filterchange", () => {
    queueMicrotask(() => projects.forEach((project) => {
      if (project.hidden && project.classList.contains("is-open")) {
        setProjectExpanded(project, false, { updateHash: false });
      }
    }));
  });

  const collapseButton = document.querySelector("[data-collapse-works]");
  collapseButton?.addEventListener("click", () => {
    projects.forEach((project) => setProjectExpanded(project, false, { updateHash: false }));
    history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
    archive.scrollIntoView({ behavior: reduceMotion.matches ? "auto" : "smooth", block: "start" });
  });

  const openFromHash = (immediate = false) => {
    if (!window.location.hash) return;
    const target = document.getElementById(decodeURIComponent(window.location.hash.slice(1)));
    const project = target?.closest(".work-showcase");
    if (project) setProjectExpanded(project, true, { immediate, updateHash: false });
  };

  window.addEventListener("hashchange", () => openFromHash(false));
  openFromHash(true);
  archive.classList.add("is-folder-ready");
})();
