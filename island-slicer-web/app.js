
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
  fitBtn:$('#fitBtn'), actualBtn:$('#actualBtn'), zoomLabel:$('#zoomLabel')
};
const ctx=els.canvas.getContext('2d',{willReadFrequently:true});
const assets=[]; let selectedId=null,outputDir=null;
let previewActive=false;
let selectedPartId=null;
let sidebarMode='assets';
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
    row.addEventListener('click',()=>{
      selectPart(c.id,true);
    });
    els.partList.appendChild(row);
  }
}

function selectPart(id,focusList=false){
  const a=getSelected();
  if(!previewActive || !a?.analysis)return;
  if(!a.analysis.components.some(c=>c.id===id))return;

  selectedPartId=id;
  renderPartList();
  drawSelected();

  const row=els.partList.querySelector(`[data-part-id="${id}"]`);
  if(row){
    row.scrollIntoView({block:'nearest'});
  }
  if(focusList) els.partList.focus({preventScroll:true});
}

function stepPart(delta){
  const a=getSelected();
  if(!previewActive || !a?.analysis?.components?.length)return;

  const parts=a.analysis.components;
  let index=selectedPartId==null
    ? (delta>0 ? -1 : 0)
    : parts.findIndex(c=>c.id===selectedPartId);

  if(index<0) index=0;
  index=(index+delta+parts.length)%parts.length;
  selectPart(parts[index].id,false);
}

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

  const hasSelection=selectedPartId!=null;
  for(let i=0;i<labels.length;i++){
    const p=i*4;
    const label=labels[i];

    if(label!==0){
      if(hasSelection){
        if(label===selectedPartId){
          // 当前选中项：更亮、更清晰。
          d[p]=86; d[p+1]=173; d[p+2]=255; d[p+3]=showOriginal?72:185;
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

  drawBoundaries(a,hasSelection?selectedPartId:null);

  if(els.showBounds.checked){
    ctx.save();
    ctx.lineWidth=Math.max(2,Math.round(a.width/1200));
    ctx.font=`${Math.max(18,Math.round(a.width/70))}px Segoe UI`;
    ctx.textBaseline='top';
    for(const c of components){
      const active=!hasSelection || c.id===selectedPartId;
      ctx.globalAlpha=active?1:0.22;
      ctx.strokeStyle=active?'rgba(110,190,255,.98)':'rgba(110,190,255,.48)';
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

function drawBoundaries(a,onlyId=null){
  const {labels}=a.analysis,w=a.width,h=a.height;
  ctx.save();
  ctx.fillStyle='rgba(235,245,255,.96)';
  for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){
    const i=y*w+x,l=labels[i];
    if(!l)continue;
    if(onlyId!=null && l!==onlyId)continue;
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

els.viewport.addEventListener('wheel',e=>{
  if(!getSelected())return;
  e.preventDefault();
  zoomBy(e.deltaY<0?1.12:1/1.12,e.clientX,e.clientY);
},{passive:false});

els.viewport.addEventListener('mousedown',e=>{
  if(!getSelected() || e.button!==0) return;
  if(e.target.closest('.zoom-toolbar')) return;
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
  const enteringPreview=!previewActive;
  els.busy.classList.remove('hidden');
  els.analyzeBtn.disabled=true;

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
      els.busy.classList.add('hidden');
      els.analyzeBtn.disabled=false;
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
  if(!previewActive || sidebarMode!=='parts')return;
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

async function exportAsset(a){
  const folder=await outputDir.getDirectoryHandle(safeName(baseName(a.name)),{create:true});
  const partsDir=await folder.getDirectoryHandle('parts',{create:true});
  const padding=a.analysis.settings.padding;
  const manifest={source:{name:a.name,width:a.width,height:a.height,type:a.file.type,size:a.file.size},settings:{...a.analysis.settings},generatedAt:new Date().toISOString(),parts:[]};

  for(const c of a.analysis.components){
    const x=Math.max(0,c.minX-padding),y=Math.max(0,c.minY-padding),x2=Math.min(a.width,c.maxX+1+padding),y2=Math.min(a.height,c.maxY+1+padding),w=x2-x,h=y2-y;
    const pc=document.createElement('canvas');pc.width=w;pc.height=h;const pctx=pc.getContext('2d',{willReadFrequently:true});
    const out=pctx.createImageData(w,h),src=a.sourceImageData.data,dst=out.data,labels=a.analysis.labels;
    for(let yy=0;yy<h;yy++){const sy=y+yy;for(let xx=0;xx<w;xx++){const sx=x+xx,si=sy*a.width+sx;if(labels[si]!==c.id)continue;const sp=si*4,dp=(yy*w+xx)*4;dst[dp]=src[sp];dst[dp+1]=src[sp+1];dst[dp+2]=src[sp+2];dst[dp+3]=src[sp+3];}}
    pctx.putImageData(out,0,0);
    const filename=`part_${String(c.id).padStart(3,'0')}.png`;await writeCanvas(partsDir,filename,pc);
    manifest.parts.push({id:c.id,file:`parts/${filename}`,sourceBounds:{x:c.minX,y:c.minY,width:c.width,height:c.height},exportBounds:{x,y,width:w,height:h},area:c.area});
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
