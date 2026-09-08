(function () {
  "use strict";
  if (!window.PetStorage) return;
  const loaded = window.PetStorage.load();
  let state = loaded.state;
  let coolingDown = false;
  let stage = null;
  let saved = loaded.saved;
  function persist() { saved = window.PetStorage.save(state); }
  const pet = document.querySelector("[data-pet]");
  const petImage = document.querySelector("[data-pet-image]");
  const nameDisplays = Array.from(document.querySelectorAll("[data-pet-name]"));
  const copy = document.querySelector("[data-pet-copy]");
  const warning = document.querySelector("[data-storage-warning]");
  const buttons = Array.from(document.querySelectorAll("[data-pet-action]"));
  const conditionCopy = {
    sleepy: "有点困了，想缩成一小团。",
    hungry: "肚子空空，正在认真等饭。",
    dirty: "刚刚玩得太投入，沾了一点灰。",
    sad: "今天稍微有点委屈，陪陪它吧。",
    happy: "状态闪闪发亮，连空气都变软了。",
    idle: "安静地待在这里，也是一件很好的事。"
  };
  const feedback = {
    feed: "吃饱了一点，满足地晃了晃。",
    pet: "被轻轻摸了摸，开心得压扁了一点。",
    pinch: "咦，谁在后面？软乎乎地弹了回来。",
    play: "滚了一小圈，精神不错！",
    sleep: "盖好小毯子，呼吸慢了下来。",
    clean: "灰尘被轻轻擦掉，又变得干干净净。"
  };
  const conditionImages = {
    sleepy: "assets/images/pet/pet-sleepy.png",
    hungry: "assets/images/pet/pet-hungry.png",
    dirty: "assets/images/pet/pet-sad.png",
    sad: "assets/images/pet/pet-sad.png",
    happy: "assets/images/pet/pet-excited.png",
    idle: "assets/images/pet/pet-loving.png"
  };
  const actionImages = {
    feed: "assets/images/pet/pet-eating.png",
    pet: "assets/images/pet/pet-loving.png",
    pinch: "assets/images/pet/pet-excited.png",
    play: "assets/images/pet/pet-playing.png",
    sleep: "assets/images/pet/pet-sleepy.png",
    clean: "assets/images/pet/pet-loving.png"
  };
  [...new Set([...Object.values(conditionImages), ...Object.values(actionImages)])].forEach((source) => {
    const preload = new Image();
    preload.src = source;
  });
  function render(message, action) {
    const condition = window.PetStorage.getCondition(state);
    stage?.setCondition(condition);
    nameDisplays.forEach((element) => { element.textContent = state.name; });
    copy.textContent = message || conditionCopy[condition];
    const nextImage = actionImages[action] || conditionImages[condition];
    if (petImage && petImage.getAttribute("src") !== nextImage) petImage.setAttribute("src", nextImage);
    document.querySelectorAll("[data-stat]").forEach((element) => {
      const key = element.dataset.stat;
      const value = Math.round(state[key]);
      element.querySelector("[data-stat-value]").textContent = `${value}`;
      const track = element.querySelector("[role='progressbar']");
      track.setAttribute("aria-valuemin", "0");
      track.setAttribute("aria-valuemax", "100");
      track.setAttribute("aria-valuenow", `${value}`);
      element.querySelector("[data-stat-fill]").style.setProperty("--value", `${value}%`);
    });
    pet.classList.toggle("is-sleeping", condition === "sleepy");
    pet.classList.toggle("is-hungry", condition === "hungry");
    pet.classList.toggle("is-happy", condition === "happy");
    if (warning) warning.hidden = saved;
  }
  function performAction(action) {
    if (coolingDown) return;
    coolingDown = true;
    buttons.forEach((item) => { item.disabled = true; });
    state = window.PetStorage.interact(state, action);
    persist();
    stage?.playAction(action);
    pet.classList.add(`action-${action}`);
    render(feedback[action], action);
    window.setTimeout(() => {
      pet.classList.remove(`action-${action}`);
      buttons.forEach((item) => { item.disabled = false; });
      coolingDown = false;
      render();
    }, 1200);
  }
  buttons.forEach((button) => button.addEventListener("click", () => performAction(button.dataset.petAction)));
  const form = document.querySelector("[data-name-form]");
  const nameToggle = document.querySelector("[data-name-toggle]");
  const nameCancel = document.querySelector("[data-name-cancel]");
  const nameInput = form?.elements.petName;
  const nameCount = document.querySelector("[data-name-count]");
  const setNameEditor = (open) => {
    if (!form || !nameToggle) return;
    form.hidden = !open;
    nameToggle.setAttribute("aria-expanded", `${open}`);
    nameToggle.textContent = open ? "收起" : "修改";
    if (open && nameInput) {
      nameInput.value = state.name;
      if (nameCount) nameCount.textContent = `${Array.from(nameInput.value).length}/12`;
      window.requestAnimationFrame(() => { nameInput.focus(); nameInput.select(); });
    }
  };
  nameToggle?.addEventListener("click", () => setNameEditor(form?.hidden ?? true));
  nameCancel?.addEventListener("click", () => setNameEditor(false));
  nameInput?.addEventListener("input", () => {
    nameInput.setCustomValidity("");
    if (nameCount) nameCount.textContent = `${Array.from(nameInput.value).length}/12`;
  });
  if (form) form.addEventListener("submit", (event) => {
    event.preventDefault();
    const input = form.elements.petName;
    const result = window.PetStorage.rename(state, input.value);
    if (!result.ok) { input.setCustomValidity("请输入 1～12 个字符的名字"); input.reportValidity(); return; }
    input.setCustomValidity("");
    state = result.state;
    persist();
    render(`好，从现在开始就叫 ${state.name}。`);
    setNameEditor(false);
  });
  const dialog = document.querySelector("[data-reset-dialog]");
  document.querySelector("[data-reset-open]")?.addEventListener("click", () => dialog?.showModal());
  document.querySelector("[data-reset-cancel]")?.addEventListener("click", () => dialog?.close());
  document.querySelector("[data-reset-confirm]")?.addEventListener("click", () => {
    state = window.PetStorage.reset();
    persist();
    stage?.setAppearance(state.appearance);
    syncChoices();
    dialog?.close();
    render("重新见面啦。这次也请多关照。 ");
  });
  window.setInterval(() => {
    const next = window.PetStorage.settle(state);
    if (JSON.stringify(next) !== JSON.stringify(state)) { state = next; persist(); render(); }
  }, 60000);
  render(loaded.isNew ? "第一次见面。它已经把名字留给你决定。" : null);
  const fields = {
    expression: ['face', '表情', ['安静', '好奇', '开心', '困困', '惊讶']],
    shape: ['face', '轮廓', ['经典', '圆一点', '扁一点']],
    eyes: ['face', '眼距', ['原本的样子', '靠近一点', '分开一点']],
    material: ['face', '质感', ['哑光', '绒感', '陶瓷']],
    color: ['face', '颜色', ['煤黑', '雾蓝', '灰紫']],
    outfit: ['style', '衣服', ['不穿', '围巾', '蝴蝶结', '披风']],
    hat: ['style', '头饰', ['不戴', '贝雷帽', '小叶子']],
    prop: ['style', '道具', ['饮料杯', '空手', '饭碗', '小书']],
    pose: ['pose', '姿势', ['坐好', '侧身', '趴低', '转身']],
    scene: ['scene', '环境', ['暖光摄影棚', '夜色小屋', '阴天窗边', '小小花园']]
  };
  Object.entries(fields).forEach(([key, [panel, title, labels]]) => {
    const row = document.createElement('div'); row.className = 'studio-options';
    const label = document.createElement('span'); label.textContent = title; row.append(label);
    window.PetStorage.APPEARANCE_OPTIONS[key].forEach((value, index) => {
      const button = document.createElement('button');button.type='button';button.className='studio-choice';
      button.textContent=labels[index];button.dataset.appearance=key;button.dataset.value=value;
      button.disabled=true;
      button.addEventListener('click',()=>{
        state=window.PetStorage.setAppearance(state,{[key]:value});persist();stage?.setAppearance(state.appearance);syncChoices();
        render(`${title}换成了${labels[index]}。`);
      });row.append(button);
    });document.querySelector(`[data-panel="${panel}"]`)?.append(row);
  });
  function syncChoices() {
    document.querySelectorAll('[data-appearance]').forEach(button=>button.setAttribute('aria-pressed',String(state.appearance[button.dataset.appearance]===button.dataset.value)));
  }
  syncChoices();
  const presets=document.createElement('div');presets.className='studio-options';
  const presetLabel=document.createElement('span');presetLabel.textContent='搭配';presets.append(presetLabel);
  [
    ['午后读书',{outfit:'scarf',hat:'beret',prop:'book',scene:'window'}],
    ['花园散步',{outfit:'bow',hat:'leaf',prop:'none',scene:'garden'}],
    ['晚安小球',{outfit:'cape',hat:'none',prop:'cup',scene:'night'}]
  ].forEach(([label,patch])=>{
    const button=document.createElement('button');button.className='studio-choice';button.textContent=label;button.disabled=true;button.dataset.preset='';
    button.addEventListener('click',()=>{state=window.PetStorage.setAppearance(state,patch);persist();stage?.setAppearance(state.appearance);syncChoices();render(`换上了「${label}」。`);});presets.append(button);
  });document.querySelector('[data-panel="style"]')?.prepend(presets);
  const tabs=Array.from(document.querySelectorAll('[data-tab]'));
  function selectTab(button) {
    tabs.forEach(tab=>{const active=tab===button;tab.setAttribute('aria-selected',String(active));tab.tabIndex=active?0:-1;});
    document.querySelectorAll('[data-panel]').forEach(panel=>panel.hidden=panel.dataset.panel!==button.dataset.tab);
  }
  tabs.forEach((button,index)=>{
    button.addEventListener('click',()=>selectTab(button));
    button.addEventListener('keydown',event=>{
      if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();
      const next=event.key==='Home'?0:event.key==='End'?tabs.length-1:(index+(event.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;
      selectTab(tabs[next]);tabs[next].focus();
    });
  });
  const host=document.querySelector('[data-studio]');
  document.querySelector('[data-view-reset]')?.addEventListener('click',()=>stage?.resetView());
  document.querySelector('[data-photo]')?.addEventListener('click',()=>stage?.photo());
  if(host) import('./pet-3d.js').then(({createPetStage})=>{
    stage=createPetStage(host,performAction);stage.setAppearance(state.appearance);stage.setCondition(window.PetStorage.getCondition(state));
    document.querySelectorAll('[data-appearance], [data-preset], [data-photo]').forEach(button=>button.disabled=false);
  }).catch(()=>{
    host.classList.remove('is-ready');host.querySelector('canvas')?.remove();
    host.querySelector('[data-stage-hint]').textContent=location.protocol==='file:'?'请通过本地网站地址打开 3D 房间；下方照顾功能仍可使用。':'这台设备暂时无法显示 3D，仍可使用下方按钮照顾小球。';
  });
  window.addEventListener('pagehide',event=>{if(!event.persisted)stage?.dispose();});
})();
