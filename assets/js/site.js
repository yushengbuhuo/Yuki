(function () {
  "use strict";
  const config = window.SITE_CONFIG || {};

  const initPageLoader = () => {
    const root = document.documentElement;
    const storageKey = "yuki_page_loader_seen_v1";
    let hasPlayed = false;
    try { hasPlayed = sessionStorage.getItem(storageKey) === "1"; } catch (_) {}
    if (hasPlayed) {
      root.classList.remove("has-page-loader");
      return;
    }
    root.classList.add("has-page-loader");

    const loader = document.createElement("div");
    loader.className = "page-loader";
    loader.setAttribute("role", "status");
    loader.setAttribute("aria-label", "网站加载中，小球正在喝水");
    loader.innerHTML = `
      <div class="page-loader-scene" aria-hidden="true">
        <img class="page-loader-pet" src="assets/images/pet/pet-excited.png" width="240" height="240" alt="">
        <span class="page-loader-straw"></span>
        <span class="page-loader-cup"><span class="page-loader-water"></span></span>
      </div>
      <p>小球正在喝水……</p>`;
    document.body.prepend(loader);

    const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const startedAt = performance.now();
    let finishing = false;
    const finish = () => {
      if (finishing) return;
      finishing = true;
      const minimum = reducedMotion ? 0 : 900;
      const wait = Math.max(0, minimum - (performance.now() - startedAt));
      window.setTimeout(() => {
        loader.classList.add("is-finishing");
        window.setTimeout(() => {
          loader.classList.add("is-leaving");
          root.classList.remove("has-page-loader");
          try { sessionStorage.setItem(storageKey, "1"); } catch (_) {}
          window.setTimeout(() => loader.remove(), reducedMotion ? 20 : 460);
        }, reducedMotion ? 20 : 720);
      }, wait);
    };

    if (document.readyState === "complete") finish();
    else window.addEventListener("load", finish, { once: true });
    window.setTimeout(finish, 5000);
  };

  initPageLoader();

  document.querySelectorAll("[data-config]").forEach((element) => {
    const key = element.dataset.config;
    if (typeof config[key] !== "string") return;
    if (!config[key].trim()) {
      element.hidden = true;
      return;
    }
    if (element instanceof HTMLAnchorElement && key === "email") {
      element.href = `mailto:${config[key]}`;
    } else if (element instanceof HTMLAnchorElement && ["github", "bilibili", "jike", "xiaohongshu"].includes(key)) {
      element.href = config[key];
    } else {
      element.textContent = config[key];
    }
  });

  const page = document.body.dataset.page;
  document.querySelectorAll("[data-nav]").forEach((link) => {
    if (link.dataset.nav === page) link.setAttribute("aria-current", "page");
  });

  const toggle = document.querySelector("[data-menu-toggle]");
  const nav = document.querySelector("[data-nav-menu]");
  const closeMenu = () => {
    if (!toggle || !nav) return;
    toggle.setAttribute("aria-expanded", "false");
    nav.dataset.open = "false";
  };
  if (toggle && nav) {
    toggle.addEventListener("click", () => {
      const isOpen = toggle.getAttribute("aria-expanded") === "true";
      toggle.setAttribute("aria-expanded", String(!isOpen));
      nav.dataset.open = String(!isOpen);
      if (!isOpen) nav.querySelector("a")?.focus();
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        closeMenu();
        toggle.focus();
      }
    });
    nav.addEventListener("click", (event) => {
      if (event.target.closest("a")) closeMenu();
    });
    window.matchMedia("(min-width: 761px)").addEventListener("change", closeMenu);
  }

  const backTopButtons = Array.from(document.querySelectorAll("[data-back-top]"));
  if (backTopButtons.length) {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateBackTop = () => {
      const visible = window.scrollY > Math.min(520, window.innerHeight * .72);
      backTopButtons.forEach((button) => {
        button.classList.toggle("is-visible", visible);
        button.tabIndex = visible ? 0 : -1;
        button.setAttribute("aria-hidden", String(!visible));
      });
    };
    backTopButtons.forEach((button) => {
      button.addEventListener("click", () => window.scrollTo({ top: 0, behavior: reducedMotion.matches ? "auto" : "smooth" }));
    });
    updateBackTop();
    window.addEventListener("scroll", updateBackTop, { passive: true });
    window.addEventListener("resize", updateBackTop);
  }

  const year = document.querySelector("[data-year]");
  if (year) year.textContent = String(new Date().getFullYear());

  const initHeroPetGaze = () => {
    const hero = document.querySelector("[data-hero-gaze]");
    const stage = hero?.querySelector("[data-hero-stage]");
    const pet = hero?.querySelector("[data-hero-pet]");
    if (!hero || !stage || !pet) return;

    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const touchQuery = window.matchMedia("(hover: none), (pointer: coarse)");
    const lookTargets = Array.from(document.querySelectorAll("[data-hero-look]"));
    const eyeCenterInImage = { x: .613, y: .514 };
    const stableDelay = 100;
    const frontCooldown = 3000;
    const current = {
      leftX: 0, leftY: 0, rightX: 0, rightY: 0,
      leftScaleX: 1, rightScaleX: 1,
      turn: 0, scaleX: 1, scaleY: 1,
      shadowScale: 1, glowX: 0, glowY: 0
    };
    const target = { ...current };
    let petBounds = pet.getBoundingClientRect();
    let pointerInside = false;
    let lastPointer = null;
    let priorityTarget = null;
    let activeState = "look-front";
    let trackingVector = null;
    let candidateState = "";
    let candidateTimer = 0;
    let candidateOptions = null;
    let frame = 0;
    let previousFrameTime = performance.now();
    let lastFrontAction = -frontCooldown;
    let frontTilt = 0;
    let frontTimers = [];
    let observeTimer = 0;
    let observeResetTimer = 0;

    const measure = () => {
      petBounds = pet.getBoundingClientRect();
    };

    const clearFrontSequence = () => {
      frontTimers.forEach((timer) => window.clearTimeout(timer));
      frontTimers = [];
      frontTilt = 0;
      pet.classList.remove("is-blinking", "is-blink-recovering");
    };

    const stateTargets = (state) => {
      const maxX = petBounds.width * .30 * .09;
      const maxY = petBounds.height * .19 * .07;
      const eyeGapInset = petBounds.width * .1464 * .02;
      const next = {
        leftX: 0, leftY: 0, rightX: 0, rightY: 0,
        leftScaleX: 1, rightScaleX: 1,
        turn: 0, scaleX: 1, scaleY: 1,
        shadowScale: 1, glowX: 0, glowY: 0
      };
      if (state === "look-up") {
        next.leftY = -maxY;
        next.rightY = -maxY;
        next.scaleY = 1.015;
        next.shadowScale = .994;
        next.glowY = -3;
      } else if (state === "look-right") {
        next.leftX = maxX;
        next.rightX = maxX * 1.06;
        next.leftScaleX = .97;
        next.turn = 2;
        next.glowX = 3;
      } else if (state === "look-down") {
        next.leftX = eyeGapInset;
        next.rightX = -eyeGapInset;
        next.leftY = maxY;
        next.rightY = maxY;
        next.scaleX = 1.006;
        next.scaleY = .985;
        next.shadowScale = 1.012;
        next.glowY = 3;
      } else if (state === "look-left") {
        next.leftX = -maxX * 1.06;
        next.rightX = -maxX;
        next.rightScaleX = .97;
        next.turn = -2;
        next.glowX = -3;
      } else {
        next.turn = frontTilt;
      }
      return next;
    };

    const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));

    const continuousTargets = ({ x, y }) => {
      const maxX = petBounds.width * .30 * .09;
      const maxY = petBounds.height * .19 * .07;
      const eyeGapInset = petBounds.width * .1464 * .02 * Math.max(0, y);
      const next = {
        leftX: x * maxX * (x < 0 ? 1.06 : 1) + eyeGapInset,
        leftY: y * maxY,
        rightX: x * maxX * (x > 0 ? 1.06 : 1) - eyeGapInset,
        rightY: y * maxY,
        leftScaleX: 1 - Math.max(0, x) * .03,
        rightScaleX: 1 - Math.max(0, -x) * .03,
        turn: x * 2,
        scaleX: 1 + Math.max(0, y) * .006,
        scaleY: 1 - y * .015,
        shadowScale: 1 + Math.max(0, y) * .012 - Math.max(0, -y) * .006,
        glowX: x * 3,
        glowY: y * 3
      };
      next.leftX = clamp(next.leftX, -maxX * 1.06, maxX * 1.06);
      next.rightX = clamp(next.rightX, -maxX * 1.06, maxX * 1.06);
      return next;
    };

    const updateTargets = () => {
      const next = motionQuery.matches
        ? stateTargets("look-front")
        : activeState === "look-free" && trackingVector
          ? continuousTargets(trackingVector)
          : stateTargets(activeState);
      Object.assign(target, next);
      if (motionQuery.matches) {
        frontTilt = 0;
        pet.classList.remove("is-blinking", "is-blink-recovering");
      }
    };

    const playFrontSequence = () => {
      const now = performance.now();
      if (motionQuery.matches || now - lastFrontAction < frontCooldown) return;
      lastFrontAction = now;
      clearFrontSequence();
      frontTimers.push(window.setTimeout(() => {
        pet.classList.remove("is-blink-recovering");
        pet.classList.add("is-blinking");
      }, 250));
      frontTimers.push(window.setTimeout(() => {
        pet.classList.remove("is-blinking");
        pet.classList.add("is-blink-recovering");
      }, 410));
      frontTimers.push(window.setTimeout(() => {
        pet.classList.remove("is-blink-recovering");
      }, 630));
      frontTimers.push(window.setTimeout(() => {
        frontTilt = (Math.random() < .5 ? -1 : 1) * (3 + Math.random());
        updateTargets();
      }, 550));
      frontTimers.push(window.setTimeout(() => {
        frontTilt = 0;
        updateTargets();
      }, 900));
    };

    const commitState = (state, options = {}) => {
      const nextState = motionQuery.matches ? "look-front" : state;
      const previousState = activeState;
      activeState = nextState;
      trackingVector = null;
      candidateState = "";
      candidateOptions = null;
      window.clearTimeout(candidateTimer);
      hero.dataset.gazeState = nextState;
      hero.dataset.gazeSource = options.source || "pointer";
      if (nextState !== "look-front") clearFrontSequence();
      updateTargets();
      if (nextState === "look-front" && previousState !== "look-front" && options.playFront !== false) {
        playFrontSequence();
      }
    };

    const requestState = (state, options = {}) => {
      if (motionQuery.matches) {
        commitState("look-front", { source: "reduced", playFront: false });
        return;
      }
      if (state === activeState) {
        candidateState = "";
        candidateOptions = null;
        window.clearTimeout(candidateTimer);
        return;
      }
      if (options.immediate) {
        commitState(state, options);
        return;
      }
      if (candidateState === state) {
        candidateOptions = options;
        return;
      }
      candidateState = state;
      candidateOptions = options;
      window.clearTimeout(candidateTimer);
      candidateTimer = window.setTimeout(() => {
        if (candidateState === state) commitState(state, candidateOptions || options);
      }, stableDelay);
    };

    const vectorToPoint = (clientX, clientY) => {
      const eyeX = petBounds.left + petBounds.width * eyeCenterInImage.x;
      const eyeY = petBounds.top + petBounds.height * eyeCenterInImage.y;
      const radius = Math.max(1, Math.min(petBounds.width, petBounds.height) * .5);
      const rawX = (clientX - eyeX) / radius;
      const rawY = (clientY - eyeY) / radius;
      const distance = Math.hypot(rawX, rawY);
      const limit = Math.max(1, distance);
      return { x: rawX / limit, y: rawY / limit, distance };
    };

    const lookAtPoint = (clientX, clientY, options = {}) => {
      measure();
      if (motionQuery.matches) {
        commitState("look-front", { source: "reduced", playFront: false });
        return;
      }

      const vector = vectorToPoint(clientX, clientY);
      const frontRadius = activeState === "look-front" ? .06 : .045;
      if (vector.distance <= frontRadius) {
        trackingVector = { x: 0, y: 0 };
        Object.assign(target, continuousTargets(trackingVector));
        requestState("look-front", options);
        return;
      }

      window.clearTimeout(candidateTimer);
      candidateState = "";
      candidateOptions = null;
      if (activeState === "look-front") clearFrontSequence();
      activeState = "look-free";
      trackingVector = { x: vector.x, y: vector.y };
      hero.dataset.gazeState = "look-free";
      hero.dataset.gazeSource = options.source || "pointer";
      Object.assign(target, continuousTargets(trackingVector));
    };

    const lookAtElement = (element, options = {}) => {
      if (!element) return false;
      const forcedState = element.dataset.heroLookState;
      hero.dataset.gazeIntent = forcedState || "target";
      if (["look-up", "look-right", "look-down", "look-left", "look-front"].includes(forcedState)) {
        requestState(forcedState, {
          source: element.dataset.heroLook || "control",
          ...options
        });
        return true;
      }
      const bounds = element.getBoundingClientRect();
      lookAtPoint(bounds.left + bounds.width / 2, bounds.top + bounds.height / 2, {
        source: element.dataset.heroLook || "control",
        ...options
      });
      return true;
    };

    const lookFrontWithoutAction = (source = "rest") => {
      requestState("look-front", { source, playFront: false });
    };

    const applyState = () => {
      pet.style.setProperty("--hero-eye-left-x", `${current.leftX.toFixed(2)}px`);
      pet.style.setProperty("--hero-eye-left-y", `${current.leftY.toFixed(2)}px`);
      pet.style.setProperty("--hero-eye-right-x", `${current.rightX.toFixed(2)}px`);
      pet.style.setProperty("--hero-eye-right-y", `${current.rightY.toFixed(2)}px`);
      pet.style.setProperty("--hero-eye-left-scale-x", current.leftScaleX.toFixed(4));
      pet.style.setProperty("--hero-eye-right-scale-x", current.rightScaleX.toFixed(4));
      pet.style.setProperty("--hero-body-turn", `${current.turn.toFixed(3)}deg`);
      pet.style.setProperty("--hero-body-scale-x", current.scaleX.toFixed(4));
      pet.style.setProperty("--hero-body-scale-y", current.scaleY.toFixed(4));
      pet.style.setProperty("--hero-shadow-scale", current.shadowScale.toFixed(4));
      stage.style.setProperty("--hero-glow-x", `${current.glowX.toFixed(2)}px`);
      stage.style.setProperty("--hero-glow-y", `${current.glowY.toFixed(2)}px`);
    };

    const approach = (value, destination, elapsed, response) => (
      value + (destination - value) * (1 - Math.exp(-elapsed / response))
    );

    const animate = (time) => {
      const elapsed = Math.min(40, Math.max(0, time - previousFrameTime));
      previousFrameTime = time;
      const eyeResponse = 52;
      const bodyResponse = 100;
      current.leftX = approach(current.leftX, target.leftX, elapsed, eyeResponse);
      current.leftY = approach(current.leftY, target.leftY, elapsed, eyeResponse);
      current.rightX = approach(current.rightX, target.rightX, elapsed, eyeResponse);
      current.rightY = approach(current.rightY, target.rightY, elapsed, eyeResponse);
      current.leftScaleX = approach(current.leftScaleX, target.leftScaleX, elapsed, eyeResponse);
      current.rightScaleX = approach(current.rightScaleX, target.rightScaleX, elapsed, eyeResponse);
      current.turn = approach(current.turn, target.turn, elapsed, bodyResponse);
      current.scaleX = approach(current.scaleX, target.scaleX, elapsed, bodyResponse);
      current.scaleY = approach(current.scaleY, target.scaleY, elapsed, bodyResponse);
      current.shadowScale = approach(current.shadowScale, target.shadowScale, elapsed, bodyResponse);
      current.glowX = approach(current.glowX, target.glowX, elapsed, 135);
      current.glowY = approach(current.glowY, target.glowY, elapsed, 135);
      applyState();
      frame = window.requestAnimationFrame(animate);
    };

    const restoreAvailableGaze = () => {
      if (priorityTarget && lookAtElement(priorityTarget, { playFront: false })) return;
      if (pointerInside && lastPointer && !touchQuery.matches) {
        lookAtPoint(lastPointer.x, lastPointer.y, { source: "pointer" });
        return;
      }
      lookFrontWithoutAction();
    };

    const clearPassiveTimers = () => {
      window.clearTimeout(observeTimer);
      window.clearTimeout(observeResetTimer);
      window.clearTimeout(candidateTimer);
      clearFrontSequence();
    };

    const scheduleObservation = () => {
      window.clearTimeout(observeTimer);
      if (motionQuery.matches || !touchQuery.matches || document.hidden) return;
      observeTimer = window.setTimeout(() => {
        if (!priorityTarget) {
          const choices = ["look-up", "look-right", "look-down", "look-left"];
          const choice = choices[Math.floor(Math.random() * choices.length)];
          commitState(choice, { source: "autonomous", playFront: false });
          observeResetTimer = window.setTimeout(() => lookFrontWithoutAction("autonomous"), 850);
        }
        scheduleObservation();
      }, 5600 + Math.random() * 3400);
    };

    stage.addEventListener("pointerenter", (event) => {
      if (event.pointerType === "touch") return;
      pointerInside = true;
    });
    stage.addEventListener("pointermove", (event) => {
      if (event.pointerType === "touch") return;
      pointerInside = true;
      lastPointer = { x: event.clientX, y: event.clientY };
      if (!priorityTarget) lookAtPoint(event.clientX, event.clientY, { source: "pointer" });
    }, { passive: true });
    stage.addEventListener("pointerleave", (event) => {
      if (event.pointerType === "touch") return;
      pointerInside = false;
      lastPointer = null;
      if (!priorityTarget) lookFrontWithoutAction("leave");
    });
    stage.addEventListener("pointerdown", (event) => {
      if (event.pointerType !== "touch") return;
      lookAtPoint(event.clientX, event.clientY, { source: "touch", immediate: true });
      scheduleObservation();
    }, { passive: true });

    stage.addEventListener("pointercancel", () => {
      if (!priorityTarget) lookFrontWithoutAction("touch-cancel");
    });

    lookTargets.forEach((element) => {
      const prioritize = (options = {}) => {
        priorityTarget = element;
        lookAtElement(element, { source: element.dataset.heroLook || "control", ...options });
      };
      const release = () => {
        if (priorityTarget !== element) return;
        priorityTarget = null;
        restoreAvailableGaze();
      };
      element.addEventListener("pointerenter", (event) => {
        if (event.pointerType !== "touch") prioritize();
      });
      element.addEventListener("pointerleave", (event) => {
        if (event.pointerType !== "touch" && document.activeElement !== element) release();
      });
      element.addEventListener("focus", prioritize);
      element.addEventListener("blur", release);
      element.addEventListener("pointerdown", (event) => {
        if (event.pointerType !== "touch") return;
        prioritize({ immediate: true, playFront: false });
        window.setTimeout(release, 760);
      }, { passive: true });
    });

    const onResize = () => {
      measure();
      if (priorityTarget && lookAtElement(priorityTarget, { playFront: false })) return;
      if (pointerInside && lastPointer && !touchQuery.matches) {
        lookAtPoint(lastPointer.x, lastPointer.y, { source: "pointer" });
        return;
      }
      updateTargets();
    };
    window.addEventListener("resize", onResize, { passive: true });
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        window.cancelAnimationFrame(frame);
        frame = 0;
        clearPassiveTimers();
        return;
      }
      previousFrameTime = performance.now();
      frame = window.requestAnimationFrame(animate);
      scheduleObservation();
    });
    const onMotionChange = () => {
      clearPassiveTimers();
      activeState = "look-front";
      trackingVector = null;
      hero.dataset.gazeState = "look-front";
      hero.dataset.gazeSource = motionQuery.matches ? "reduced" : "rest";
      updateTargets();
      if (motionQuery.matches) {
        Object.assign(current, target);
        applyState();
      }
      scheduleObservation();
    };
    if (typeof motionQuery.addEventListener === "function") motionQuery.addEventListener("change", onMotionChange);
    else motionQuery.addListener(onMotionChange);
    if (typeof touchQuery.addEventListener === "function") touchQuery.addEventListener("change", onMotionChange);
    else touchQuery.addListener(onMotionChange);

    measure();
    hero.dataset.gazeState = "look-front";
    hero.dataset.gazeSource = motionQuery.matches ? "reduced" : "rest";
    updateTargets();
    Object.assign(current, target);
    applyState();
    previousFrameTime = performance.now();
    frame = window.requestAnimationFrame(animate);
    scheduleObservation();
  };

  const initAmbientStory = () => {
    if (document.querySelector(".ambient-current-canvas")) return;
    const canvas = document.createElement("canvas");
    canvas.className = "ambient-current-canvas";
    canvas.setAttribute("aria-hidden", "true");
    const context = canvas.getContext("2d", { alpha: true, desynchronized: true });
    if (!context) return;
    document.body.prepend(canvas);

    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const palette = {
      wine: [139, 63, 67],
      ink: [67, 62, 55],
      sage: [116, 121, 105],
      gold: [199, 158, 70],
      rose: [185, 119, 116]
    };
    let width = 0;
    let height = 0;
    let pixelRatio = 1;
    let frame = 0;
    let running = false;
    let motes = [];
    let travelers = [];
    let pointerX = 0;
    let pointerY = 0;
    let targetPointerX = 0;
    let targetPointerY = 0;

    const rgba = (color, alpha) => `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${alpha})`;

    const storyPoint = (progress, time, lane = 0) => {
      const drift = motionQuery.matches ? 0 : time * .000055;
      const x = progress * (width + 220) - 110 + pointerX;
      const sweep = Math.sin(progress * Math.PI * 1.85 + drift * 5.2 - .8);
      const whisper = Math.sin(progress * Math.PI * 5.4 - drift * 2.1) * .14;
      const y = height * (.7 - progress * .34 + (sweep + whisper) * .12) + lane + pointerY;
      return { x, y };
    };

    const rebuildScene = () => {
      const moteCount = width < 560 ? 16 : Math.min(42, Math.round(width / 34));
      motes = Array.from({ length: moteCount }, (_, index) => ({
        progress: (index / moteCount + Math.random() * .08) % 1,
        speed: .000006 + Math.random() * .000012,
        lane: (Math.random() - .5) * Math.min(150, height * .2),
        size: .55 + Math.random() * 1.35,
        phase: Math.random() * Math.PI * 2,
        color: index % 5 === 0 ? palette.gold : index % 3 === 0 ? palette.sage : palette.wine
      }));
      const travelerCount = width < 560 ? 4 : 8;
      travelers = Array.from({ length: travelerCount }, (_, index) => ({
        progress: (index / travelerCount + .08 + Math.random() * .12) % 1,
        speed: .0000045 + Math.random() * .000004,
        lane: (Math.random() - .5) * Math.min(120, height * .14),
        scale: .72 + Math.random() * .7,
        phase: Math.random() * Math.PI * 2,
        type: index % 3,
        color: index % 2 === 0 ? palette.wine : palette.gold
      }));
    };

    const resize = () => {
      width = Math.max(320, window.innerWidth);
      height = Math.max(480, window.innerHeight);
      pixelRatio = Math.min(window.devicePixelRatio || 1, width < 640 ? 1.2 : 1.5);
      canvas.width = Math.round(width * pixelRatio);
      canvas.height = Math.round(height * pixelRatio);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      rebuildScene();
      if (motionQuery.matches) draw(0);
    };

    const drawThread = (time, lane, color, lineWidth, dash = []) => {
      context.beginPath();
      const steps = width < 640 ? 46 : 78;
      for (let step = 0; step <= steps; step += 1) {
        const progress = step / steps;
        const point = storyPoint(progress, time, lane);
        if (step === 0) context.moveTo(point.x, point.y);
        else context.lineTo(point.x, point.y);
      }
      context.setLineDash(dash);
      context.lineDashOffset = -time * .004;
      context.lineCap = "round";
      context.strokeStyle = color;
      context.lineWidth = lineWidth;
      context.stroke();
      context.setLineDash([]);
    };

    const drawBotanicalAnchor = (time) => {
      const scale = Math.min(width, height) / 860;
      const sway = motionQuery.matches ? 0 : Math.sin(time * .00032) * 2.2;
      context.save();
      context.translate(width * .085 + pointerX * .16, height * .84 + pointerY * .1);
      context.scale(Math.max(.66, scale), Math.max(.66, scale));
      context.rotate(sway * Math.PI / 360);
      context.lineCap = "round";
      context.strokeStyle = rgba(palette.sage, .18);
      context.lineWidth = 1.25;
      context.beginPath();
      context.moveTo(-84, 66);
      context.bezierCurveTo(-35, 33, -8, -44, 28, -138);
      context.stroke();
      [[-42, 24, -76, -9, -29], [-18, -26, 24, -62, 32], [5, -78, -31, -108, -24], [20, -112, 54, -146, 30]].forEach((leaf, index) => {
        const [x, y, tipX, tipY, bend] = leaf;
        context.beginPath();
        context.moveTo(x, y);
        context.quadraticCurveTo(x + bend, y - 7, tipX, tipY);
        context.quadraticCurveTo(x + bend * .22, y + 11, x, y);
        context.strokeStyle = rgba(index % 2 ? palette.wine : palette.sage, .13 + index * .012);
        context.stroke();
      });
      context.restore();
    };

    const drawSuspendedAnchor = (time) => {
      const scale = Math.min(width, height) / 900;
      const drift = motionQuery.matches ? 0 : Math.sin(time * .00038) * 4;
      context.save();
      context.translate(width * .88 + pointerX * .12, height * .15 + pointerY * .08);
      context.scale(Math.max(.7, scale), Math.max(.7, scale));
      context.rotate(drift * Math.PI / 720);
      context.lineCap = "round";
      context.strokeStyle = rgba(palette.ink, .12);
      context.lineWidth = 1;
      context.beginPath();
      context.arc(0, 0, 92, Math.PI * .08, Math.PI * .92);
      context.stroke();
      [-54, 0, 54].forEach((x, index) => {
        const length = 72 + index * 15;
        context.beginPath();
        context.moveTo(x, -55 + Math.abs(x) * .12);
        context.quadraticCurveTo(x + drift * .6, 8, x + drift, length);
        context.strokeStyle = rgba(index === 1 ? palette.gold : palette.wine, .13);
        context.stroke();
        context.save();
        context.translate(x + drift, length + 8);
        context.rotate(Math.PI / 4 + drift * .002);
        context.strokeRect(-5 - index, -5 - index, 10 + index * 2, 10 + index * 2);
        context.restore();
      });
      context.restore();
    };

    const drawTraveler = (traveler, time) => {
      const progress = motionQuery.matches ? traveler.progress : (traveler.progress + time * traveler.speed) % 1;
      const point = storyPoint(progress, time, traveler.lane);
      const ahead = storyPoint(Math.min(1, progress + .008), time, traveler.lane);
      const angle = Math.atan2(ahead.y - point.y, ahead.x - point.x);
      const flutter = motionQuery.matches ? 0 : Math.sin(time * .0013 + traveler.phase);
      context.save();
      context.translate(point.x, point.y);
      context.rotate(angle + flutter * .09);
      context.scale(traveler.scale, traveler.scale);
      context.strokeStyle = rgba(traveler.color, .22);
      context.fillStyle = rgba(traveler.color, .08);
      context.lineWidth = 1;
      context.lineCap = "round";
      if (traveler.type === 0) {
        context.beginPath();
        context.moveTo(-7, 0);
        context.quadraticCurveTo(-1, -8 - flutter * 2, 7, 0);
        context.quadraticCurveTo(0, 6 + flutter, -7, 0);
        context.fill();
        context.stroke();
      } else if (traveler.type === 1) {
        context.beginPath();
        context.moveTo(-8, 2);
        context.quadraticCurveTo(-3, -5 - flutter * 2, 0, 0);
        context.quadraticCurveTo(4, -6 + flutter * 2, 9, 1);
        context.stroke();
      } else {
        context.rotate(Math.PI / 4);
        context.strokeRect(-3.5, -3.5, 7, 7);
      }
      context.restore();
    };

    const draw = (time) => {
      context.clearRect(0, 0, width, height);
      pointerX += (targetPointerX - pointerX) * .022;
      pointerY += (targetPointerY - pointerY) * .022;

      const haze = context.createRadialGradient(width * .72, height * .18, 0, width * .72, height * .18, Math.max(width, height) * .62);
      haze.addColorStop(0, rgba(palette.rose, .035));
      haze.addColorStop(.5, rgba(palette.gold, .017));
      haze.addColorStop(1, "rgba(255,255,255,0)");
      context.fillStyle = haze;
      context.fillRect(0, 0, width, height);

      drawBotanicalAnchor(time);
      drawSuspendedAnchor(time);
      drawThread(time, -30, rgba(palette.wine, .12), 1.05);
      drawThread(time, 4, rgba(palette.sage, .095), .85, [2, 15]);
      drawThread(time, 31, rgba(palette.gold, .11), .8, [1, 18]);

      motes.forEach((mote) => {
        const progress = motionQuery.matches ? mote.progress : (mote.progress + time * mote.speed) % 1;
        const point = storyPoint(progress, time, mote.lane);
        const pulse = .65 + Math.sin(time * .001 + mote.phase) * .35;
        context.beginPath();
        context.arc(point.x, point.y, Math.max(.35, mote.size * pulse), 0, Math.PI * 2);
        context.fillStyle = rgba(mote.color, .1 + pulse * .11);
        context.fill();
      });
      travelers.forEach((traveler) => drawTraveler(traveler, time));
    };

    const animate = (time) => {
      if (!running) return;
      draw(time + window.scrollY * .11);
      frame = window.requestAnimationFrame(animate);
    };

    const start = () => {
      window.cancelAnimationFrame(frame);
      running = !document.hidden && !motionQuery.matches;
      if (running) frame = window.requestAnimationFrame(animate);
      else draw(0);
    };

    let resizeFrame = 0;
    window.addEventListener("resize", () => {
      window.cancelAnimationFrame(resizeFrame);
      resizeFrame = window.requestAnimationFrame(resize);
    }, { passive: true });
    window.addEventListener("pointermove", (event) => {
      if (motionQuery.matches || event.pointerType === "touch") return;
      targetPointerX = (event.clientX / width - .5) * 10;
      targetPointerY = (event.clientY / height - .5) * 8;
    }, { passive: true });
    document.addEventListener("visibilitychange", start);
    if (typeof motionQuery.addEventListener === "function") motionQuery.addEventListener("change", start);
    else motionQuery.addListener(start);
    resize();
    start();
  };

  const initGuidedCards = () => {
    const cards = document.querySelectorAll(".work-showcase, .work-card");
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
    if (!cards.length || reduceMotion.matches || !finePointer.matches) return;
    const animations = new WeakMap();

    const playResponse = (card, entering, event) => {
      if (card.classList.contains("is-open")) return;
      animations.get(card)?.cancel();
      const bounds = card.getBoundingClientRect();
      const pointer = typeof event.clientX === "number" ? event.clientX : bounds.left + bounds.width / 2;
      const direction = pointer < bounds.left + bounds.width / 2 ? -1 : 1;
      const keyframes = entering ? [
        { transform: "translate3d(0, 0, 0) rotate(0deg)", offset: 0 },
        { transform: `translate3d(${direction * .42}px, -.72px, 0) rotate(${direction * .11}deg)`, offset: .14 },
        { transform: `translate3d(${direction * -.34}px, -.48px, 0) rotate(${direction * -.085}deg)`, offset: .28 },
        { transform: `translate3d(${direction * .27}px, -.68px, 0) rotate(${direction * .064}deg)`, offset: .42 },
        { transform: `translate3d(${direction * -.2}px, -.52px, 0) rotate(${direction * -.045}deg)`, offset: .56 },
        { transform: `translate3d(${direction * .13}px, -.64px, 0) rotate(${direction * .029}deg)`, offset: .7 },
        { transform: `translate3d(${direction * -.06}px, -.58px, 0) rotate(${direction * -.014}deg)`, offset: .84 },
        { transform: "translate3d(0, -.6px, 0) rotate(0deg)", offset: 1 }
      ] : [
        { transform: "translate3d(0, -.6px, 0) rotate(0deg)", offset: 0 },
        { transform: `translate3d(${direction * -.36}px, -.12px, 0) rotate(${direction * -.09}deg)`, offset: .14 },
        { transform: `translate3d(${direction * .27}px, -.34px, 0) rotate(${direction * .065}deg)`, offset: .28 },
        { transform: `translate3d(${direction * -.19}px, -.08px, 0) rotate(${direction * -.044}deg)`, offset: .42 },
        { transform: `translate3d(${direction * .12}px, -.2px, 0) rotate(${direction * .028}deg)`, offset: .58 },
        { transform: `translate3d(${direction * -.05}px, -.05px, 0) rotate(${direction * -.013}deg)`, offset: .76 },
        { transform: "translate3d(0, 0, 0) rotate(0deg)", offset: 1 }
      ];
      card.classList.add("is-card-responding");
      const animation = card.animate(keyframes, {
        duration: entering ? 340 : 420,
        easing: "linear",
        fill: "forwards"
      });
      animations.set(card, animation);
      animation.finished.finally(() => {
        if (animations.get(card) !== animation) return;
        if (!entering) {
          animation.cancel();
          animations.delete(card);
        }
        card.classList.remove("is-card-responding");
      }).catch(() => {});
    };

    cards.forEach((card) => {
      card.addEventListener("pointerenter", (event) => playResponse(card, true, event));
      card.addEventListener("pointerleave", (event) => playResponse(card, false, event));
      card.addEventListener("focusin", (event) => {
        if (!card.matches(":hover")) playResponse(card, true, event);
      });
      card.addEventListener("focusout", (event) => {
        if (!card.contains(event.relatedTarget) && !card.matches(":hover")) playResponse(card, false, event);
      });
      card.addEventListener("click", () => {
        window.requestAnimationFrame(() => {
          if (!card.classList.contains("is-open")) return;
          animations.get(card)?.cancel();
          animations.delete(card);
          card.classList.remove("is-card-responding");
        });
      });
    });
  };

  const initProcessReel = () => {
    const stage = document.querySelector("[data-process-stage]");
    const reels = Array.from(document.querySelectorAll("[data-process-reel]"));
    if (!stage || !reels.length) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const lanes = reels.map((reel) => {
      const track = reel.querySelector("[data-process-track]");
      const group = reel.querySelector("[data-process-group]");
      if (!track || !group) return null;
      const clone = group.cloneNode(true);
      clone.classList.add("is-clone");
      clone.setAttribute("aria-hidden", "true");
      clone.querySelectorAll("a, button, input, select, textarea").forEach((element) => { element.tabIndex = -1; });
      track.append(clone);
      return {
        reel,
        group,
        clone,
        loopWidth: 0,
        direction: Number(reel.dataset.processDirection) < 0 ? -1 : 1,
        speed: Math.max(8, Number(reel.dataset.processSpeed) || 18)
      };
    }).filter(Boolean);
    if (!lanes.length) return;

    let pointerPaused = false;
    let focusPaused = false;
    let viewportPaused = true;
    let manualPauseUntil = 0;
    let previousTime = performance.now();

    const measure = () => {
      lanes.forEach((lane) => {
        const previousWidth = lane.loopWidth;
        lane.loopWidth = lane.clone.offsetLeft - lane.group.offsetLeft;
        if (!lane.loopWidth) return;
        if (!previousWidth) {
          lane.reel.scrollLeft = lane.direction < 0 && !reducedMotion.matches ? lane.loopWidth : 0;
        } else if (lane.reel.scrollLeft >= lane.loopWidth) {
          lane.reel.scrollLeft %= lane.loopWidth;
        }
      });
    };

    stage.addEventListener("pointerenter", () => {
      pointerPaused = true;
      stage.dataset.paused = "true";
    });
    stage.addEventListener("pointerleave", () => {
      pointerPaused = false;
      stage.dataset.paused = "false";
    });
    stage.addEventListener("focusin", () => { focusPaused = true; });
    stage.addEventListener("focusout", (event) => {
      focusPaused = event.relatedTarget instanceof Node && stage.contains(event.relatedTarget);
    });
    lanes.forEach(({ reel }) => {
      reel.addEventListener("pointerdown", () => { manualPauseUntil = performance.now() + 4000; }, { passive: true });
      reel.addEventListener("wheel", () => { manualPauseUntil = performance.now() + 3200; }, { passive: true });
    });
    if ("IntersectionObserver" in window) {
      const observer = new IntersectionObserver(([entry]) => {
        viewportPaused = !entry?.isIntersecting;
        previousTime = performance.now();
      }, { threshold: .12 });
      observer.observe(stage);
    } else {
      viewportPaused = false;
    }
    window.addEventListener("resize", measure, { passive: true });
    reducedMotion.addEventListener("change", () => {
      lanes.forEach((lane) => {
        if (reducedMotion.matches) lane.reel.scrollLeft = 0;
      });
      previousTime = performance.now();
    });
    document.addEventListener("visibilitychange", () => { previousTime = performance.now(); });

    const animateFilm = (time) => {
      const elapsed = Math.min(48, Math.max(0, time - previousTime));
      previousTime = time;
      const playing = !reducedMotion.matches && !pointerPaused && !focusPaused && !viewportPaused && !document.hidden && time >= manualPauseUntil;
      stage.classList.toggle("is-running", playing);
      if (playing) {
        lanes.forEach((lane) => {
          if (!lane.loopWidth) return;
          lane.reel.scrollLeft += lane.direction * lane.speed * elapsed / 1000;
          if (lane.reel.scrollLeft >= lane.loopWidth) lane.reel.scrollLeft -= lane.loopWidth;
          if (lane.reel.scrollLeft <= 0 && lane.direction < 0) lane.reel.scrollLeft += lane.loopWidth;
        });
      }
      window.requestAnimationFrame(animateFilm);
    };

    measure();
    window.requestAnimationFrame(animateFilm);
  };

  initHeroPetGaze();
  initAmbientStory();
  initGuidedCards();
  initProcessReel();

  const petSummary = document.querySelector("[data-pet-summary]");
  if (petSummary && window.PetStorage) {
    const saved = window.PetStorage.peek();
    petSummary.textContent = saved
      ? window.PetStorage.getSummary(saved)
      : "这里住着一只小球。它的进度会保存在这台设备里。";
  }
})();
