import('./pet-world.js?v=roomlife3').catch(error=>{
  console.error('庭院加载失败',error);
  const loading=document.querySelector('#loading');
  loading.hidden=false;
  loading.innerHTML='<p>庭院暂时没能打开，请刷新后再试。</p><a href="index.html">返回首页</a>';
});
