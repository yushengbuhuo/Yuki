// A small, optional layer over the scene's existing interactions.
export function mountWorldControls(experience){
  const guide=document.querySelector('#world-guide'),open=document.querySelector('#guide-open'),close=document.querySelector('#guide-close'),controls=document.querySelector('#world-controls'),canvas=document.querySelector('canvas'),status=document.querySelector('#status');
  const key='zerohey_pet_guide_v1';
  function show(value){guide.hidden=!value;open.setAttribute('aria-expanded',String(value));if(value)controls.open=false;}
  function dismiss(){show(false);try{localStorage.setItem(key,'1');}catch{}open.focus();}
  try{show(localStorage.getItem(key)!=='1');}catch{show(true);}
  open.addEventListener('click',()=>show(guide.hidden));
  close.addEventListener('click',dismiss);
  controls.addEventListener('toggle',()=>{if(controls.open)show(false);});
  document.querySelector('.world-ui').addEventListener('keydown',e=>{
    if(e.key!=='Escape')return;
    e.preventDefault();experience.cancel();
    if(!guide.hidden)dismiss();else{controls.open=false;controls.querySelector('summary').focus();}
  });
  document.querySelectorAll('[data-input]').forEach(button=>button.addEventListener('click',()=>experience.control(button.dataset.input)));
  document.querySelectorAll('[data-camera]').forEach(button=>button.addEventListener('click',()=>experience.cameraControl(button.dataset.camera)));
  const grab=document.querySelector('[data-grab]');
  // Keep touch users inside the controls; the original handler focuses the scene.
  grab.addEventListener('click',()=>grab.focus({preventScroll:true}));
  let timer;
  const observer=new MutationObserver(()=>{
    status.classList.add('visible');clearTimeout(timer);timer=setTimeout(()=>status.classList.remove('visible'),6500);
  });
  observer.observe(status,{childList:true,characterData:true,subtree:true});
  // Reflect pointer, keyboard and button actions alike without moving focus.
  const sync=setInterval(()=>{
    const held=experience.held;
    grab.textContent=held?'释放小球（G）':'抓取小球（G）';grab.setAttribute('aria-pressed',String(!!held));
  },250);
  canvas.setAttribute('aria-describedby','scene-help');
  const help=document.createElement('p');help.id='scene-help';help.className='accessible';help.textContent='H 摇铃唤羊，M 环境声，T 切换时刻，P 暂停昼夜，E 出入，G 抓取，方向键调整，空格释放，Escape 取消。玩法提示与随手操作提供全部按钮。';document.querySelector('#world').append(help);
  addEventListener('pagehide',e=>{if(!e.persisted){observer.disconnect();clearTimeout(timer);clearInterval(sync);}});
}
