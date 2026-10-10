export function mountOutlineControls(finish){
  const enabled=document.querySelector('#art-outline-enabled');
  const controls=Object.fromEntries(['width','strength','brush','scale'].map(key=>[key,document.querySelector('#art-outline-'+key)]));
  try{
    const saved=JSON.parse(localStorage.getItem('manor-art-outline')||'null');
    if(saved&&typeof saved==='object'){
      if(typeof saved.enabled==='boolean')enabled.checked=saved.enabled;
      for(const [key,input] of Object.entries(controls))if(typeof saved[key]==='number'&&Number.isFinite(saved[key]))input.value=String(Math.max(Number(input.min),Math.min(Number(input.max),saved[key])));
    }
  }catch{}
  function update(){
    const value={enabled:enabled.checked};
    for(const [key,input] of Object.entries(controls)){
      value[key]=Number(input.value);
      document.querySelector('#outline-'+key+'-value').textContent=value[key].toFixed(key==='width'||key==='scale'?1:2)+(key==='width'?' px':key==='scale'?'×':'');
    }
    finish.setOutline(value);try{localStorage.setItem('manor-art-outline',JSON.stringify(value));}catch{}
  }
  enabled.addEventListener('change',update);for(const input of Object.values(controls))input.addEventListener('input',update);update();
  return {dispose(){enabled.removeEventListener('change',update);for(const input of Object.values(controls))input.removeEventListener('input',update);}};
}
