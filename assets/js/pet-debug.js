// Sample only completed game frames, not the browser's requestAnimationFrame
// callbacks (which can run faster than the game's 30/60 FPS limit).
export function createDebugPanel({renderer,targetFps,readScene}){
  const panel=document.querySelector('#debug-panel'),list=panel.querySelector('dl'),artPanel=document.querySelector('.art-controls'),narrow=matchMedia('(max-width:700px)');
  const definitions=[
    ['scene','场景 / 风格'],
    ['fps','实际 FPS / 上限','按完成绘制的游戏帧统计；手机模式上限为 30 FPS。'],
    ['interval','帧间隔 · 平均 / P95','包含帧率限制和等待。P95 表示 95% 的帧间隔不超过这个数值。'],
    ['cpu','CPU 更新与提交','从游戏更新开始到提交完绘制的主线程耗时，不是 GPU 渲染耗时。'],
    ['calls','Draw calls · 均值 / 峰值','包含场景、阴影和后处理的全部绘制次数。'],
    ['triangles','三角形 / 帧 · 均值','包含实例、阴影和后处理的提交三角形数，不是模型文件的面数。'],
    ['resolution','实际渲染分辨率'],
    ['ratio','渲染比例 / 屏幕 DPR','渲染像素比和设备像素比；自适应降级可能降低渲染比例。'],
    ['instances','当前草 / 叶实例','当前视野中提交的实例数；室内为 0。'],
    ['resources','几何体 / 纹理 / 程序','WebGL 已分配的资源数量，不代表显存字节数。'],
    ['bloom','辉光缓冲 / 额外绘制']
  ];
  const fields={};
  for(const [id,label,title] of definitions){
    const row=document.createElement('div'),term=document.createElement('dt'),value=document.createElement('dd');
    term.textContent=label;if(title)term.title=title;
    value.dataset.debugMetric=id;value.textContent='—';row.append(term,value);list.append(row);fields[id]=value;
  }
  const count=new Intl.NumberFormat('zh-CN',{maximumFractionDigits:0});
  let intervals=[],cpuTotal=0,callsTotal=0,trianglesTotal=0,peakCalls=0,lastFrame=0,lastRefresh=0,updates=0;
  function reset(){intervals=[];cpuTotal=0;callsTotal=0;trianglesTotal=0;peakCalls=0;lastFrame=0;lastRefresh=0;}
  function toggle(){reset();if(panel.open){if(narrow.matches)artPanel.open=false;for(const value of Object.values(fields))value.textContent='采样中…';}try{localStorage.setItem('manor-debug-open',String(panel.open));}catch{}}
  function openArt(){if(narrow.matches&&artPanel.open)panel.open=false;}
  try{panel.open=new URLSearchParams(location.search).get('debug')==='1'||localStorage.getItem('manor-debug-open')==='true';}catch{panel.open=new URLSearchParams(location.search).get('debug')==='1';}
  panel.addEventListener('toggle',toggle);artPanel.addEventListener('toggle',openArt);document.addEventListener('visibilitychange',reset);
  if(panel.open)toggle();
  return {
    beginFrame(){return panel.open?performance.now():0;},
    endFrame(ms,start){
      if(!panel.open||!start)return;
      if(!lastFrame){lastFrame=ms;lastRefresh=ms;return;}
      intervals.push(ms-lastFrame);lastFrame=ms;
      cpuTotal+=performance.now()-start;
      callsTotal+=renderer.info.render.calls;trianglesTotal+=renderer.info.render.triangles;peakCalls=Math.max(peakCalls,renderer.info.render.calls);
      if(ms-lastRefresh<500)return;
      const n=intervals.length,span=ms-lastRefresh,sorted=[...intervals].sort((a,b)=>a-b),context=readScene(),finish=context.style.finish;
      fields.scene.textContent=(context.mode==='garden'?'庄园':'小屋')+' · '+context.style.name;
      fields.fps.textContent=(n*1000/span).toFixed(1)+' / '+targetFps;
      fields.interval.textContent=(span/n).toFixed(1)+' / '+sorted[Math.ceil(n*.95)-1].toFixed(1)+' ms';
      fields.cpu.textContent=(cpuTotal/n).toFixed(2)+' ms';
      fields.calls.textContent=Math.round(callsTotal/n)+' / '+peakCalls;
      fields.triangles.textContent=count.format(trianglesTotal/n);
      fields.resolution.textContent=renderer.domElement.width+' × '+renderer.domElement.height;
      fields.ratio.textContent=renderer.getPixelRatio().toFixed(2)+' / '+devicePixelRatio.toFixed(2);
      fields.instances.textContent=count.format(context.vegetation?.grassActive||0)+' / '+count.format(context.vegetation?.leavesActive||0);
      fields.resources.textContent=[renderer.info.memory.geometries,renderer.info.memory.textures,renderer.info.programs?.length||0].join(' / ');
      fields.bloom.textContent=finish.bloomActive?finish.bloomSize.join(' × ')+' / '+finish.bloomPasses+' 次':'关闭 / 0 次';
      intervals=[];cpuTotal=0;callsTotal=0;trianglesTotal=0;peakCalls=0;lastRefresh=ms;updates++;
    },
    diagnostics:()=>({open:panel.open,updates,samples:intervals.length}),
    dispose(){panel.removeEventListener('toggle',toggle);artPanel.removeEventListener('toggle',openArt);document.removeEventListener('visibilitychange',reset);}
  };
}
