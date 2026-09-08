(() => {
  "use strict";

  const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

  document.querySelectorAll("[data-gallery-slider]").forEach((slider) => {
    const stage = slider.querySelector("[data-gallery-rail]");
    const slides = Array.from(stage?.children || []);
    const previous = slider.querySelector("[data-gallery-prev]");
    const next = slider.querySelector("[data-gallery-next]");
    const status = slider.querySelector("[data-gallery-status]");
    if (!stage || slides.length === 0) return;

    let current = 0;
    let timer = 0;
    let pointerStart = null;
    let inView = false;
    let manuallyPaused = false;
    let interactionPaused = false;

    slider.classList.add("gallery-stage");
    stage.setAttribute("aria-roledescription", "轮播图");

    const pause = document.createElement("button");
    pause.type = "button";
    pause.className = "gallery-play-toggle";
    pause.setAttribute("aria-label", "暂停自动播放");
    pause.textContent = "Ⅱ";
    next?.insertAdjacentElement("afterend", pause);

    const canAutoplay = () => (
      slides.length > 1
      && !motionQuery.matches
      && !document.hidden
      && inView
      && !manuallyPaused
      && !interactionPaused
    );

    const stopTimer = () => {
      window.clearTimeout(timer);
      timer = 0;
    };

    const schedule = () => {
      stopTimer();
      if (!canAutoplay()) return;
      timer = window.setTimeout(() => show(current + 1, "next"), 5200);
    };

    const show = (index, direction = "next") => {
      current = (index + slides.length) % slides.length;
      slider.dataset.direction = direction;
      slides.forEach((slide, slideIndex) => {
        const active = slideIndex === current;
        slide.classList.toggle("is-active", active);
        slide.setAttribute("aria-hidden", String(!active));
        slide.toggleAttribute("inert", !active);
      });
      if (status) status.textContent = `${current + 1} / ${slides.length}`;
      schedule();
    };

    const setInteractionPause = (paused) => {
      interactionPaused = paused;
      paused ? stopTimer() : schedule();
    };

    previous?.addEventListener("click", () => show(current - 1, "previous"));
    next?.addEventListener("click", () => show(current + 1, "next"));
    pause.addEventListener("click", () => {
      manuallyPaused = !manuallyPaused;
      pause.textContent = manuallyPaused ? "▶" : "Ⅱ";
      pause.setAttribute("aria-label", manuallyPaused ? "继续自动播放" : "暂停自动播放");
      pause.setAttribute("aria-pressed", String(manuallyPaused));
      schedule();
    });

    stage.addEventListener("keydown", (event) => {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      event.preventDefault();
      show(current + (event.key === "ArrowLeft" ? -1 : 1), event.key === "ArrowLeft" ? "previous" : "next");
    });
    stage.addEventListener("pointerdown", (event) => {
      if (event.pointerType === "mouse") return;
      pointerStart = { x: event.clientX, y: event.clientY };
    }, { passive: true });
    stage.addEventListener("pointerup", (event) => {
      if (!pointerStart) return;
      const xDistance = event.clientX - pointerStart.x;
      const yDistance = event.clientY - pointerStart.y;
      pointerStart = null;
      if (Math.abs(xDistance) < 42 || Math.abs(xDistance) < Math.abs(yDistance)) return;
      show(current + (xDistance < 0 ? 1 : -1), xDistance < 0 ? "next" : "previous");
    }, { passive: true });

    slider.addEventListener("mouseenter", () => setInteractionPause(true));
    slider.addEventListener("mouseleave", () => setInteractionPause(false));
    slider.addEventListener("focusin", () => setInteractionPause(true));
    slider.addEventListener("focusout", (event) => {
      if (!slider.contains(event.relatedTarget)) setInteractionPause(false);
    });
    document.addEventListener("visibilitychange", schedule);

    const observer = new IntersectionObserver((entries) => {
      inView = entries[0]?.isIntersecting ?? false;
      schedule();
    }, { rootMargin: "120px 0px", threshold: 0.12 });
    observer.observe(slider);

    const handleMotionChange = () => {
      slider.classList.toggle("is-reduced-motion", motionQuery.matches);
      schedule();
    };
    if (typeof motionQuery.addEventListener === "function") motionQuery.addEventListener("change", handleMotionChange);
    else motionQuery.addListener(handleMotionChange);

    show(0);
    handleMotionChange();
  });
})();
