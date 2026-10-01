
const $ = s => document.querySelector(s);
const els = {
  fileInput:$('#fileInput'), pickOutputBtn:$('#pickOutputBtn'), outputDirLabel:$('#outputDirLabel'),
  assetList:$('#assetList'), assetCount:$('#assetCount'), partCount:$('#partCount'), assetsTabBtn:$('#assetsTabBtn'), partsTabBtn:$('#partsTabBtn'), assetsPane:$('#assetsPane'), partsPane:$('#partsPane'), partsAssetName:$('#partsAssetName'), currentName:$('#currentName'), currentMeta:$('#currentMeta'),
  analyzeBtn:$('#analyzeBtn'), cancelPreviewBtn:$('#cancelPreviewBtn'), exportBtn:$('#exportBtn'), exportAllBtn:$('#exportAllBtn'),
  canvas:$('#previewCanvas'), viewport:$('#canvasViewport'), stage:$('#canvasStage'),
  emptyHint:$('#emptyHint'), busy:$('#busy'),
  alphaThreshold:$('#alphaThreshold'), alphaValue:$('#alphaValue'),
  minArea:$('#minArea'), minAreaValue:$('#minAreaValue'), minDetectedInfo:$('#minDetectedInfo'),
  padding:$('#padding'), paddingValue:$('#paddingValue'),
  mergeRadius:$('#mergeRadius'), mergeRadiusValue:$('#mergeRadiusValue'),
  connectivity:$('#connectivity'), showOriginal:$('#showOriginal'), dimOutside:$('#dimOutside'), showBounds:$('#showBounds'),
  stats:$('#stats'), partList:$('#partList'), zoomOutBtn:$('#zoomOutBtn'), zoomInBtn:$('#zoomInBtn'),
  fitBtn:$('#fitBtn'), actualBtn:$('#actualBtn'), zoomLabel:$('#zoomLabel'), checkerTheme:$('#checkerTheme'),
  mergeDialog:$('#mergeDialog'), mergeTitle:$('#mergeTitle'), mergeSearch:$('#mergeSearch'), mergeTargetList:$('#mergeTargetList'), closeMergeBtn:$('#closeMergeBtn'),
  mergeFeedback:$('#mergeFeedback'), mergeStatus:$('#mergeStatus'), undoMergeBtn:$('#undoMergeBtn'), manualMergeHint:$('#manualMergeHint')
};
const ctx=els.canvas.getContext('2d',{willReadFrequently:true});
const assets=[]; let selectedId=null,outputDir=null;
let previewActive=false;
let selectedPartId=null;
let sidebarMode='assets';
let mergeSourceId=null,mergeTargetId=null;
let mergeThumbObserver=null;
const worker=new Worker('./worker.js');

let fitScale=1;
let userZoom=1;
let panX=0;
let panY=0;
let isDragging=false;
let dragStartX=0, dragStartY=0;
let dragOriginX=0, dragOriginY=0;
const MIN_ZOOM=.05, MAX_ZOOM=8;

function baseName(n){return n.replace(/\.[^.]+$/,'')}
function safeName(s){return s.replace(/[<>:"/\\|?*\x00-\x1F]/g,'_').trim()||'asset'}
function formatMs(ms){return ms<1000?`${ms.toFixed(0)} ms`:`${(ms/1000).toFixed(2)} s`}
function escapeHtml(s){return s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function getSelected(){return assets.find(a=>a.id===selectedId)}

function setSidebarMode(mode){
  if(mode!=='parts') closeMergeDialog();
  sidebarMode=mode==='parts'?'parts':'assets';
  els.assetsTabBtn.classList.toggle('active',sidebarMode==='assets');
  els.partsTabBtn.classList.toggle('active',sidebarMode==='parts');
  els.assetsPane.classList.toggle('active',sidebarMode==='assets');
  els.partsPane.classList.toggle('active',sidebarMode==='parts');

  if(sidebarMode==='parts'){
    renderPartList();
    requestAnimationFrame(()=>els.partList.focus({preventScroll:true}));
  }
}

els.assetsTabBtn.addEventListener('click',()=>setSidebarMode('assets'));
els.partsTabBtn.addEventListener('click',()=>setSidebarMode('parts'));

function updateControls(){
  els.alphaValue.textContent=els.alphaThreshold.value;
  els.minAreaValue.textContent=`${els.minArea.value} px`;
  els.paddingValue.textContent=`${els.padding.value} px`;
  els.mergeRadiusValue.textContent=`${els.mergeRadius.value} px`;
}
['input','change'].forEach(ev=>{
  els.alphaThreshold.addEventListener(ev,updateControls);
  els.minArea.addEventListener(ev,updateControls);
  els.padding.addEventListener(ev,updateControls);
  els.mergeRadius.addEventListener(ev,updateControls);
});
updateControls();

els.showOriginal.addEventListener('change',()=>{
  els.dimOutside.disabled=!previewActive || !els.showOriginal.checked;
  drawSelected();
});
els.dimOutside.addEventListener('change',drawSelected);
els.showBounds.addEventListener('change',drawSelected);

els.fileInput.addEventListener('change',async e=>{
  for(const file of [...e.target.files]) await addAsset(file);
  e.target.value='';
  renderAssetList();
  if(!selectedId&&assets.length) selectAsset(assets[0].id);
});
async function addAsset(file){
  const bitmap=await createImageBitmap(file);
  assets.push({id:crypto.randomUUID(),file,bitmap,thumbUrl:URL.createObjectURL(file),name:file.name,width:bitmap.width,height:bitmap.height,analysis:null,sourceImageData:null});
}
function renderAssetList(){
  els.assetCount.textContent=assets.length;
  const current=getSelected();
  els.partCount.textContent=current?.analysis?.components?.length || 0;
  els.assetList.innerHTML='';
  for(const a of assets){
    const row=document.createElement('div');
    row.className='asset-item'+(a.id===selectedId?' active':'');
    row.innerHTML=`<img class="thumb" src="${a.thumbUrl}"><div class="asset-text"><div class="asset-name" title="${escapeHtml(a.name)}">${escapeHtml(a.name)}</div><div class="asset-status ${a.analysis?'ok':''}">${a.analysis?`${a.analysis.components.length} 个孤岛`:`${a.width}×${a.height}`}</div></div>`;
    row.addEventListener('click',()=>selectAsset(a.id)); els.assetList.appendChild(row);
  }
  els.exportAllBtn.disabled=!assets.some(a=>a.analysis);
}
function selectAsset(id){
  closeMergeDialog();
  selectedId=id;
  previewActive=false;
  selectedPartId=null;
  renderAssetList();
  const a=getSelected(); if(!a)return;
  els.currentName.textContent=a.name;
  els.currentMeta.textContent=`${a.width} × ${a.height}`;
  els.partsAssetName.textContent=a.name;
  els.partCount.textContent=a.analysis?.components?.length || 0;
  els.analyzeBtn.disabled=false;
  els.exportBtn.disabled=true;
  els.emptyHint.classList.add('hidden');
  setPreviewUi(false);
  drawSelected();
  updateStats(a);
  requestAnimationFrame(()=>fitToViewport());
}

function setPreviewUi(active){
  if(!active) closeMergeDialog();
  previewActive=active;
  if(!active) selectedPartId=null;
  els.analyzeBtn.textContent=active?'更新预览':'抠图预览';
  els.cancelPreviewBtn.classList.toggle('hidden',!active);
  els.cancelPreviewBtn.disabled=!active;
  els.exportBtn.disabled=!active || !getSelected()?.analysis;
  els.showOriginal.disabled=!active;
  els.showBounds.disabled=!active;
  els.dimOutside.disabled=!active || !els.showOriginal.checked;
  renderPartList();
  setSidebarMode(active?'parts':'assets');
}

function renderPartList(){
  const a=getSelected();
  updateMergeUi();
  els.partsAssetName.textContent=a?.name || '未选择素材';

  const count=a?.analysis?.components?.length || 0;
  els.partCount.textContent=count;

  if(!previewActive || !a?.analysis?.components?.length){
    els.partList.innerHTML='<div class="part-list-empty">进入抠图预览后显示</div>';
    return;
  }

  els.partList.innerHTML='';
  for(const c of a.analysis.components){
    const row=document.createElement('div');
    row.className='part-item'+(c.id===selectedPartId?' active':'');
    row.dataset.partId=String(c.id);
    row.tabIndex=-1;
    row.innerHTML=`
      <div class="part-id">#${String(c.id).padStart(2,'0')}</div>
      <div class="part-size">${c.width} × ${c.height}</div>
      <div class="part-area">${c.area} px</div>`;
    const mergeBtn=document.createElement('button');
    mergeBtn.type='button';
    mergeBtn.className='part-merge-btn';
    mergeBtn.disabled=count<2 || !!a.analyzing;
    mergeBtn.title=count<2 ? '\u81f3\u5c11\u9700\u8981\u4e24\u4e2a\u90e8\u4ef6' : '\u5408\u5e76\u5230\u5176\u4ed6\u90e8\u4ef6';
    mergeBtn.setAttribute('aria-label',`\u5c06 #${String(c.id).padStart(2,'0')} \u5408\u5e76\u5230\u5176\u4ed6\u90e8\u4ef6`);
    mergeBtn.setAttribute('aria-haspopup','dialog');
    mergeBtn.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 4h3l5 8h8M4 20h3l5-8M16 8l4 4-4 4"/></svg>';
    mergeBtn.addEventListener('click',e=>{
      e.stopPropagation();
      openMergeDialog(c.id,mergeBtn);
    });
    row.appendChild(mergeBtn);
    row.addEventListener('click',()=>{
      selectPart(selectedPartId===c.id ? null : c.id,true);
    });
    els.partList.appendChild(row);
  }
}

function selectPart(id,focusList=false){
  const a=getSelected();
  if(!previewActive || !a?.analysis)return;
  if(id!==null && !a.analysis.components.some(c=>c.id===id))return;

  selectedPartId=id;
  renderPartList();
  drawSelected();

  const row=id===null ? null : els.partList.querySelector(`[data-part-id="${id}"]`);
  if(row){
    row.scrollIntoView({block:'nearest'});
  }
  if(focusList) els.partList.focus({preventScroll:true});
}

function stepPart(delta){
  const a=getSelected();
  if(!previewActive || !a?.analysis?.components?.length)return;

  const parts=a.analysis.components;
  let index=parts.findIndex(c=>c.id===selectedPartId);

  if(index<0) index=delta>0 ? -1 : 0;
  index=(index+delta+parts.length)%parts.length;
  selectPart(parts[index].id,false);
}

function updateMergeUi(){
  const a=getSelected();
  const canUndo=!!a?.mergeHistory?.length;
  els.undoMergeBtn.disabled=!canUndo || !!a?.analyzing;
  els.mergeFeedback.classList.toggle('hidden',!previewActive || !a?.mergeMessage);
  els.mergeStatus.textContent=a?.mergeMessage || '';
  els.manualMergeHint.classList.toggle('hidden',!canUndo);
}

function openMergeDialog(sourceId,anchor){
  const a=getSelected();
  if(!previewActive || !a?.analysis || a.analyzing || a.analysis.components.length<2)return;
  if(!a.analysis.components.some(c=>c.id===sourceId))return;
  mergeSourceId=sourceId;
  mergeTargetId=null;
  els.mergeTitle.textContent=`\u5c06 #${String(sourceId).padStart(2,'0')} \u5408\u5e76\u5230\u2026`;
  els.mergeSearch.value='';
  els.mergeDialog.showModal();
  renderMergeTargets();
  const anchorRect=anchor.getBoundingClientRect();
  const dialogRect=els.mergeDialog.getBoundingClientRect();
  const left=anchorRect.right+8+dialogRect.width<=window.innerWidth-12
    ? anchorRect.right+8 : anchorRect.left-dialogRect.width-8;
  els.mergeDialog.style.left=`${Math.max(12,Math.min(left,window.innerWidth-dialogRect.width-12))}px`;
  els.mergeDialog.style.top=`${Math.max(12,Math.min(anchorRect.top,window.innerHeight-dialogRect.height-12))}px`;
  els.mergeSearch.focus();
  drawSelected();
}

function closeMergeDialog(){
  const wasOpen=mergeSourceId!==null;
  mergeSourceId=null;
  mergeTargetId=null;
  mergeThumbObserver?.disconnect();
  mergeThumbObserver=null;
  if(els.mergeDialog.open)els.mergeDialog.close();
  els.mergeTargetList.innerHTML='';
  if(wasOpen)drawSelected();
}

function previewMergeTarget(id){
  if(mergeSourceId===null || mergeTargetId===id)return;
  mergeTargetId=id;
  drawSelected();
}

function renderMergeTargets(){
  const a=getSelected();
  if(mergeSourceId===null || !a?.analysis)return;
  mergeThumbObserver?.disconnect();
  els.mergeTargetList.innerHTML='';
  previewMergeTarget(null);
  const query=els.mergeSearch.value.trim().replace(/^#/,'');
  const targets=a.analysis.components.filter(c=>c.id!==mergeSourceId &&
    (!query || String(c.id).includes(query) || String(c.id).padStart(2,'0').includes(query)));
  if(!targets.length){
    els.mergeTargetList.innerHTML='<div class="part-list-empty">\u6ca1\u6709\u5339\u914d\u7684\u90e8\u4ef6</div>';
    return;
  }
  a.partThumbs ??= new Map();
  mergeThumbObserver=new IntersectionObserver(entries=>{
    if(mergeSourceId===null || getSelected()!==a)return;
    for(const entry of entries){
      if(!entry.isIntersecting)continue;
      const thumb=entry.target;
      const c=a.analysis.components.find(c=>c.id===Number(thumb.dataset.partId));
      if(c){
        if(!a.partThumbs.has(c.id))a.partThumbs.set(c.id,makePartThumbnail(a,c));
        thumb.src=a.partThumbs.get(c.id);
      }
      mergeThumbObserver?.unobserve(thumb);
    }
  },{root:els.mergeTargetList,rootMargin:'48px'});
  for(const c of targets){
    const button=document.createElement('button');
    button.type='button';
    button.className='merge-target';
    button.dataset.partId=String(c.id);
    button.setAttribute('aria-label',`\u5408\u5e76\u5230 #${String(c.id).padStart(2,'0')}`);
    const thumb=document.createElement('img');
    thumb.className='merge-thumb';
    thumb.alt='';
    thumb.dataset.partId=String(c.id);
    if(a.partThumbs.has(c.id))thumb.src=a.partThumbs.get(c.id);
    button.appendChild(thumb);
    const text=document.createElement('span');
    text.className='merge-target-text';
    text.innerHTML=`<strong>#${String(c.id).padStart(2,'0')}</strong><span>${c.width} \u00d7 ${c.height} \u00b7 ${c.area} px</span>`;
    button.appendChild(text);
    button.addEventListener('mouseenter',()=>previewMergeTarget(c.id));
    button.addEventListener('focus',()=>previewMergeTarget(c.id));
    button.addEventListener('mouseleave',()=>{
      if(document.activeElement!==button && mergeTargetId===c.id)previewMergeTarget(null);
    });
    button.addEventListener('blur',()=>{
      if(mergeTargetId===c.id)previewMergeTarget(null);
    });
    button.addEventListener('click',()=>mergeParts(mergeSourceId,c.id));
    els.mergeTargetList.appendChild(button);
    if(!thumb.src)mergeThumbObserver.observe(thumb);
  }
}

function makePartThumbnail(a,c){
  const {canvas}=createPartCanvas(a,c);
  const thumb=document.createElement('canvas');
  thumb.width=thumb.height=44;
  const scale=Math.min(44/c.width,44/c.height);
  const width=c.width*scale,height=c.height*scale;
  thumb.getContext('2d').drawImage(canvas,(44-width)/2,(44-height)/2,width,height);
  return thumb.toDataURL('image/png');
}

function mergeParts(sourceId,targetId){
  const a=getSelected();
  if(!previewActive || !a?.analysis || a.analyzing || sourceId===targetId)return;
  const {components,labels}=a.analysis;
  const sourceIndex=components.findIndex(c=>c.id===sourceId);
  const source=components[sourceIndex],target=components.find(c=>c.id===targetId);
  if(!source || !target)return;
  const pixels=[];
  for(let i=0;i<labels.length;i++)if(labels[i]===sourceId)pixels.push(i);
  const entry={source,sourceIndex,target,selectedPartId,pixels:Uint32Array.from(pixels)};
  const merged={...target,area:source.area+target.area,
    minX:Math.min(source.minX,target.minX),minY:Math.min(source.minY,target.minY),
    maxX:Math.max(source.maxX,target.maxX),maxY:Math.max(source.maxY,target.maxY)};
  merged.width=merged.maxX-merged.minX+1;
  merged.height=merged.maxY-merged.minY+1;
  closeMergeDialog();
  for(const i of entry.pixels)labels[i]=targetId;
  a.analysis.components=components.filter(c=>c.id!==sourceId).map(c=>c.id===targetId?merged:c);
  (a.mergeHistory ??= []).push(entry);
  a.partThumbs=new Map();
  a.mergeMessage=`\u5df2\u5c06 #${String(sourceId).padStart(2,'0')} \u5408\u5e76\u5230 #${String(targetId).padStart(2,'0')}`;
  selectedPartId=targetId;
  refreshMergedParts(a);
  const row=els.partList.querySelector(`[data-part-id="${targetId}"]`);
  row?.scrollIntoView({block:'nearest'});
  els.partList.focus({preventScroll:true});
}

function undoMerge(){
  const a=getSelected();
  if(!previewActive || a?.analyzing || !a?.mergeHistory?.length)return;
  closeMergeDialog();
  const entry=a.mergeHistory.pop();
  for(const i of entry.pixels)a.analysis.labels[i]=entry.source.id;
  a.analysis.components=a.analysis.components.map(c=>c.id===entry.target.id?entry.target:c);
  a.analysis.components.splice(entry.sourceIndex,0,entry.source);
  selectedPartId=entry.selectedPartId;
  a.partThumbs=new Map();
  a.mergeMessage=`\u5df2\u64a4\u9500 #${String(entry.source.id).padStart(2,'0')} \u2192 #${String(entry.target.id).padStart(2,'0')} \u7684\u5408\u5e76`;
  refreshMergedParts(a);
  if(selectedPartId!==null)els.partList.querySelector(`[data-part-id="${selectedPartId}"]`)?.scrollIntoView({block:'nearest'});
  els.partList.focus({preventScroll:true});
}

function refreshMergedParts(a){
  renderAssetList();
  renderPartList();
  drawSelected();
  updateStats(a);
}

els.undoMergeBtn.addEventListener('click',undoMerge);
els.closeMergeBtn.addEventListener('click',closeMergeDialog);
els.mergeSearch.addEventListener('input',renderMergeTargets);
els.mergeDialog.addEventListener('cancel',e=>{e.preventDefault();closeMergeDialog()});
els.mergeDialog.addEventListener('click',e=>{
  if(e.target!==els.mergeDialog)return;
  const rect=els.mergeDialog.getBoundingClientRect();
  if(e.clientX<rect.left || e.clientX>rect.right || e.clientY<rect.top || e.clientY>rect.bottom)closeMergeDialog();
});
els.mergeDialog.addEventListener('keydown',e=>{
  if(e.key!=='ArrowDown' && e.key!=='ArrowUp')return;
  const buttons=[...els.mergeTargetList.querySelectorAll('.merge-target')];
  if(!buttons.length)return;
  e.preventDefault();
  const delta=e.key==='ArrowDown'?1:-1;
  let index=buttons.indexOf(document.activeElement);
  if(index<0)index=delta>0?-1:0;
  buttons[(index+delta+buttons.length)%buttons.length].focus();
});

function drawSelected(){
  const a=getSelected(); if(!a)return;
  els.canvas.width=a.width;
  els.canvas.height=a.height;
  els.stage.style.width=`${a.width}px`;
  els.stage.style.height=`${a.height}px`;

  ctx.clearRect(0,0,a.width,a.height);

  // 初始状态：只显示原图，没有任何抠图蒙版、边缘或编号。
  if(!previewActive || !a.analysis){
    ctx.drawImage(a.bitmap,0,0);
    applyZoom();
    return;
  }

  const {labels,components}=a.analysis;
  const showOriginal=els.showOriginal.checked;

  if(showOriginal){
    ctx.drawImage(a.bitmap,0,0);
  }

  // 用独立 overlay canvas 做 alpha 混合，避免 putImageData 覆盖掉原贴图。
  const overlayCanvas=document.createElement('canvas');
  overlayCanvas.width=a.width;
  overlayCanvas.height=a.height;
  const octx=overlayCanvas.getContext('2d',{willReadFrequently:true});
  const overlay=octx.createImageData(a.width,a.height);
  const d=overlay.data;

  const highlightIds=mergeSourceId!==null
    ? new Set([mergeSourceId,mergeTargetId].filter(id=>id!==null))
    : selectedPartId!==null ? new Set([selectedPartId]) : null;
  const hasSelection=highlightIds!==null;
  for(let i=0;i<labels.length;i++){
    const p=i*4;
    const label=labels[i];

    if(label!==0){
      if(hasSelection){
        if(highlightIds.has(label)){
          // 当前选中项：更亮、更清晰。
          const isSource=mergeSourceId!==null && label===mergeSourceId;
          d[p]=isSource?255:86; d[p+1]=isSource?180:173; d[p+2]=isSource?84:255; d[p+3]=showOriginal?72:185;
        }else{
          // 其他已识别孤岛统一压暗。
          d[p]=0; d[p+1]=0; d[p+2]=0; d[p+3]=showOriginal?155:185;
        }
      }else{
        d[p]=74; d[p+1]=129; d[p+2]=184; d[p+3]=showOriginal?46:150;
      }
    }else if(showOriginal && els.dimOutside.checked){
      d[p]=0; d[p+1]=0; d[p+2]=0; d[p+3]=118;
    }
  }
  octx.putImageData(overlay,0,0);
  ctx.drawImage(overlayCanvas,0,0);

  drawBoundaries(a,highlightIds);

  if(els.showBounds.checked){
    ctx.save();
    ctx.lineWidth=Math.max(2,Math.round(a.width/1200));
    ctx.font=`${Math.max(18,Math.round(a.width/70))}px Segoe UI`;
    ctx.textBaseline='top';
    for(const c of components){
      const active=!hasSelection || highlightIds.has(c.id);
      ctx.globalAlpha=active?1:0.22;
      ctx.strokeStyle=active
        ? (c.id===mergeSourceId?'rgba(255,180,84,.98)':'rgba(110,190,255,.98)')
        : 'rgba(110,190,255,.48)';
      ctx.setLineDash([10,7]);
      ctx.strokeRect(c.minX+.5,c.minY+.5,c.width,c.height);
      ctx.setLineDash([]);
      const label=String(c.id).padStart(2,'0');
      const tx=c.minX+5,ty=c.minY+5,m=ctx.measureText(label);
      ctx.fillStyle='rgba(0,0,0,.72)';
      ctx.fillRect(tx-3,ty-2,m.width+8,parseInt(ctx.font)+6);
      ctx.fillStyle='#fff';
      ctx.fillText(label,tx,ty);
    }
    ctx.globalAlpha=1;
    ctx.restore();
  }
  applyZoom();
}

function drawBoundaries(a,highlightIds=null){
  const {labels}=a.analysis,w=a.width,h=a.height;
  ctx.save();
  ctx.fillStyle='rgba(235,245,255,.96)';
  for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){
    const i=y*w+x,l=labels[i];
    if(!l)continue;
    if(highlightIds!==null && !highlightIds.has(l))continue;
    if(labels[i-1]!==l||labels[i+1]!==l||labels[i-w]!==l||labels[i+w]!==l){
      if(((x+y)&3)<2)ctx.fillRect(x,y,1,1);
    }
  }
  ctx.restore();
}

function calcFitScale(){
  const a=getSelected(); if(!a)return 1;
  const styles=getComputedStyle(els.viewport);
  const padX=parseFloat(styles.paddingLeft)+parseFloat(styles.paddingRight);
  const padY=parseFloat(styles.paddingTop)+parseFloat(styles.paddingBottom);
  const availW=Math.max(100,els.viewport.clientWidth-padX);
  const availH=Math.max(100,els.viewport.clientHeight-padY);
  return Math.min(availW/a.width,availH/a.height);
}
function fitToViewport(){
  if(!getSelected())return;
  fitScale=calcFitScale();
  userZoom=1;
  centerPan();
  applyZoom();
}
function getScale(){
  return Math.max(MIN_ZOOM,Math.min(MAX_ZOOM,fitScale*userZoom));
}
function centerPan(){
  const a=getSelected(); if(!a)return;
  const scale=getScale();
  panX=(els.viewport.clientWidth-a.width*scale)/2;
  panY=(els.viewport.clientHeight-a.height*scale)/2;
}
function applyZoom(){
  const a=getSelected();
  if(!a){els.zoomLabel.textContent='—';return}
  const scale=getScale();
  els.stage.style.marginRight='0px';
  els.stage.style.marginBottom='0px';
  els.stage.style.transform=`translate(${panX}px,${panY}px) scale(${scale})`;
  els.zoomLabel.textContent=`${Math.round(scale*100)}%`;
}
function setAbsoluteScale(scale){
  const a=getSelected(); if(!a)return;
  const rect=els.viewport.getBoundingClientRect();
  const cx=rect.width/2, cy=rect.height/2;
  const oldScale=getScale();
  const imageX=(cx-panX)/oldScale;
  const imageY=(cy-panY)/oldScale;
  fitScale=1;
  userZoom=Math.max(MIN_ZOOM,Math.min(MAX_ZOOM,scale));
  const newScale=getScale();
  panX=cx-imageX*newScale;
  panY=cy-imageY*newScale;
  applyZoom();
}
function zoomBy(factor,anchorX=null,anchorY=null){
  const a=getSelected(); if(!a)return;
  const rect=els.viewport.getBoundingClientRect();
  const ax=(anchorX??(rect.left+rect.width/2))-rect.left;
  const ay=(anchorY??(rect.top+rect.height/2))-rect.top;
  const oldScale=getScale();
  const imageX=(ax-panX)/oldScale;
  const imageY=(ay-panY)/oldScale;

  userZoom=Math.max(MIN_ZOOM/fitScale,Math.min(MAX_ZOOM/fitScale,userZoom*factor));
  const newScale=getScale();

  panX=ax-imageX*newScale;
  panY=ay-imageY*newScale;
  applyZoom();
}
els.zoomInBtn.addEventListener('click',()=>zoomBy(1.2));
els.zoomOutBtn.addEventListener('click',()=>zoomBy(1/1.2));
els.fitBtn.addEventListener('click',fitToViewport);
els.actualBtn.addEventListener('click',()=>setAbsoluteScale(1));
els.checkerTheme.addEventListener('change',()=>{
  els.stage.dataset.checkerTheme=els.checkerTheme.value;
});

els.viewport.addEventListener('wheel',e=>{
  if(!getSelected())return;
  e.preventDefault();
  zoomBy(e.deltaY<0?1.12:1/1.12,e.clientX,e.clientY);
},{passive:false});

els.viewport.addEventListener('mousedown',e=>{
  if(!getSelected() || e.button!==0) return;
  isDragging=true;
  dragStartX=e.clientX;
  dragStartY=e.clientY;
  dragOriginX=panX;
  dragOriginY=panY;
  els.viewport.classList.add('dragging');
  e.preventDefault();
});
window.addEventListener('mousemove',e=>{
  if(!isDragging)return;
  panX=dragOriginX+(e.clientX-dragStartX);
  panY=dragOriginY+(e.clientY-dragStartY);
  applyZoom();
});
window.addEventListener('mouseup',()=>{
  if(!isDragging)return;
  isDragging=false;
  els.viewport.classList.remove('dragging');
});

const resizeObserver=new ResizeObserver(()=>{
  if(!getSelected())return;
  if(Math.abs(userZoom-1)<0.001){
    fitScale=calcFitScale();
    centerPan();
    applyZoom();
  }
});
resizeObserver.observe(els.viewport);

els.analyzeBtn.addEventListener('click',async()=>{
  const a=getSelected();if(!a)return;
  if(a.analyzing)return;
  closeMergeDialog();
  a.analyzing=true;
  const enteringPreview=!previewActive;
  els.busy.classList.remove('hidden');
  els.analyzeBtn.disabled=true;
  renderPartList();

  requestAnimationFrame(async()=>{
    try{
      const temp=document.createElement('canvas');
      temp.width=a.width;
      temp.height=a.height;
      const tctx=temp.getContext('2d',{willReadFrequently:true});
      tctx.clearRect(0,0,a.width,a.height);
      tctx.drawImage(a.bitmap,0,0);

      const imageData=tctx.getImageData(0,0,a.width,a.height);
      a.sourceImageData=imageData;
      const alpha=new Uint8Array(a.width*a.height);
      for(let i=0,j=3;i<alpha.length;i++,j+=4)alpha[i]=imageData.data[j];

      const payload={
        alphaBuffer:alpha.buffer,
        width:a.width,
        height:a.height,
        threshold:+els.alphaThreshold.value,
        minArea:+els.minArea.value,
        mergeRadius:+els.mergeRadius.value,
        connectivity:+els.connectivity.value
      };

      const result=await runWorker(payload);
      a.analysis={
        labels:new Int32Array(result.labelsBuffer),
        components:result.components,
        elapsed:result.elapsed,
        settings:{
          alphaThreshold:+els.alphaThreshold.value,
          minArea:+els.minArea.value,
          padding:+els.padding.value,
          mergeRadius:+els.mergeRadius.value,
          connectivity:+els.connectivity.value
        }
      };
      a.mergeHistory=[];
      a.mergeMessage='';
      a.partThumbs=new Map();

      if(enteringPreview){
        els.showOriginal.checked=true;
        selectedPartId=null;
      }else if(selectedPartId!=null && !a.analysis.components.some(c=>c.id===selectedPartId)){
        selectedPartId=null;
      }
      setPreviewUi(true);
      renderAssetList();
      renderPartList();
      els.partCount.textContent=a.analysis.components.length;
      drawSelected();
      updateStats(a);
    }catch(err){
      console.error(err);
      alert(`分析失败：${err.message}`);
    }finally{
      a.analyzing=false;
      els.busy.classList.add('hidden');
      els.analyzeBtn.disabled=false;
      renderPartList();
    }
  });
});

els.cancelPreviewBtn.addEventListener('click',()=>{
  if(!getSelected())return;
  setPreviewUi(false);
  drawSelected();
});

els.partList.addEventListener('keydown',e=>{
  if(e.key==='ArrowDown'){
    e.preventDefault();
    stepPart(1);
  }else if(e.key==='ArrowUp'){
    e.preventDefault();
    stepPart(-1);
  }else if(e.key==='Escape'){
    e.preventDefault();
    selectedPartId=null;
    renderPartList();
    drawSelected();
  }
});

window.addEventListener('keydown',e=>{
  if(e.defaultPrevented || mergeSourceId!==null || !previewActive || sidebarMode!=='parts')return;
  const tag=document.activeElement?.tagName;
  // 参数滑杆、select、文本输入保持自己的方向键行为。
  if(tag==='INPUT' || tag==='SELECT' || tag==='TEXTAREA')return;
  if(e.key==='ArrowDown'){
    e.preventDefault();
    stepPart(1);
  }else if(e.key==='ArrowUp'){
    e.preventDefault();
    stepPart(-1);
  }
});
function runWorker(payload){
  return new Promise((resolve,reject)=>{
    const onMessage=e=>{cleanup();resolve(e.data)},onError=e=>{cleanup();reject(e.error||new Error(e.message))};
    const cleanup=()=>{worker.removeEventListener('message',onMessage);worker.removeEventListener('error',onError)};
    worker.addEventListener('message',onMessage);worker.addEventListener('error',onError);worker.postMessage(payload,[payload.alphaBuffer]);
  });
}
function updateMinDetectedInfo(a){
  if(!a?.analysis?.components?.length){
    els.minDetectedInfo.textContent='当前最小：—';
    els.minDetectedInfo.title='';
    return;
  }

  let smallest=a.analysis.components[0];
  for(const c of a.analysis.components){
    if(c.area<smallest.area) smallest=c;
  }

  const id=String(smallest.id).padStart(2,'0');
  els.minDetectedInfo.textContent=`当前最小：#${id} · ${smallest.area} px`;
  els.minDetectedInfo.title=`当前拆出的最小部件：#${id}，面积 ${smallest.area} px`;
}

function updateStats(a){
  const d=els.stats.querySelectorAll('strong');
  d[0].textContent=a.analysis?a.analysis.components.length:'—';
  d[1].textContent=`${a.width}×${a.height}`;
  d[2].textContent=a.analysis?formatMs(a.analysis.elapsed):'—';
  updateMinDetectedInfo(a);
}

els.pickOutputBtn.addEventListener('click',async()=>{
  if(!window.showDirectoryPicker){alert('当前浏览器不支持 File System Access API。请使用最新版 Chrome 或 Edge，并通过 localhost 打开本工具。');return}
  try{outputDir=await window.showDirectoryPicker({mode:'readwrite'});els.outputDirLabel.textContent=`导出到：${outputDir.name}`}
  catch(err){if(err.name!=='AbortError')console.error(err)}
});
els.exportBtn.addEventListener('click',async()=>{
  const a=getSelected();if(!a?.analysis)return;if(!outputDir){alert('请先选择导出目录。');return}
  await exportAsset(a);alert(`已导出：${baseName(a.name)}`);
});
els.exportAllBtn.addEventListener('click',async()=>{
  if(!outputDir){alert('请先选择导出目录。');return}
  const ready=assets.filter(a=>a.analysis);for(const a of ready)await exportAsset(a);alert(`已导出 ${ready.length} 个素材。`);
});

function createPartCanvas(a,c,padding=0){
  const x=Math.max(0,c.minX-padding),y=Math.max(0,c.minY-padding);
  const x2=Math.min(a.width,c.maxX+1+padding),y2=Math.min(a.height,c.maxY+1+padding);
  const width=x2-x,height=y2-y;
  const canvas=document.createElement('canvas');
  canvas.width=width;canvas.height=height;
  const context=canvas.getContext('2d');
  const out=context.createImageData(width,height),src=a.sourceImageData.data,dst=out.data;
  for(let yy=0;yy<height;yy++)for(let xx=0;xx<width;xx++){
    const index=(y+yy)*a.width+x+xx;
    if(a.analysis.labels[index]!==c.id)continue;
    const sp=index*4,dp=(yy*width+xx)*4;
    dst[dp]=src[sp];dst[dp+1]=src[sp+1];dst[dp+2]=src[sp+2];dst[dp+3]=src[sp+3];
  }
  context.putImageData(out,0,0);
  return {canvas,bounds:{x,y,width,height}};
}

async function exportAsset(a){
  const folder=await outputDir.getDirectoryHandle(safeName(baseName(a.name)),{create:true});
  const partsDir=await folder.getDirectoryHandle('parts',{create:true});
  const padding=a.analysis.settings.padding;
  const manifest={source:{name:a.name,width:a.width,height:a.height,type:a.file.type,size:a.file.size},settings:{...a.analysis.settings},generatedAt:new Date().toISOString(),parts:[]};

  for(const c of a.analysis.components){
    const {canvas:pc,bounds}=createPartCanvas(a,c,padding);
    const filename=`part_${String(c.id).padStart(3,'0')}.png`;await writeCanvas(partsDir,filename,pc);
    manifest.parts.push({id:c.id,file:`parts/${filename}`,sourceBounds:{x:c.minX,y:c.minY,width:c.width,height:c.height},exportBounds:bounds,area:c.area});
  }

  const preview=document.createElement('canvas');preview.width=a.width;preview.height=a.height;const pctx=preview.getContext('2d');pctx.drawImage(a.bitmap,0,0);
  pctx.lineWidth=Math.max(2,Math.round(a.width/1200));pctx.font=`${Math.max(18,Math.round(a.width/70))}px Segoe UI`;pctx.textBaseline='top';
  for(const c of a.analysis.components){
    pctx.strokeStyle='#55baff';pctx.setLineDash([10,7]);pctx.strokeRect(c.minX+.5,c.minY+.5,c.width,c.height);pctx.setLineDash([]);
    const label=String(c.id).padStart(2,'0'),tx=c.minX+5,ty=c.minY+5,m=pctx.measureText(label);pctx.fillStyle='rgba(0,0,0,.72)';pctx.fillRect(tx-3,ty-2,m.width+8,parseInt(pctx.font)+6);pctx.fillStyle='#fff';pctx.fillText(label,tx,ty);
  }
  await writeCanvas(folder,'preview_indexed.png',preview);await writeText(folder,'manifest.json',JSON.stringify(manifest,null,2));
}
async function writeCanvas(dir,name,canvas){
  const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));const handle=await dir.getFileHandle(name,{create:true});const writable=await handle.createWritable();await writable.write(blob);await writable.close();
}
async function writeText(dir,name,text){
  const handle=await dir.getFileHandle(name,{create:true});const writable=await handle.createWritable();await writable.write(text);await writable.close();
}
