
self.onmessage = (e) => {
  const { alphaBuffer, width, height, threshold, minArea, mergeRadius, connectivity } = e.data;
  const t0 = performance.now();
  const alpha = new Uint8Array(alphaBuffer);
  const n = width * height;
  let mask = new Uint8Array(n);
  for (let i = 0; i < n; i++) mask[i] = alpha[i] > threshold ? 1 : 0;
  if (mergeRadius > 0) mask = dilate(mask, width, height, mergeRadius);

  const labels = new Int32Array(n);
  const queue = new Int32Array(n);
  const comps = [];
  let label = 0;
  const neigh4 = [[1,0],[-1,0],[0,1],[0,-1]];
  const neigh8 = [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,-1],[1,-1],[-1,1]];
  const neigh = connectivity === 4 ? neigh4 : neigh8;

  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const start = y * width + x;
    if (!mask[start] || labels[start] !== 0) continue;
    label++;
    let qh = 0, qt = 0;
    queue[qt++] = start;
    labels[start] = label;
    let minX=x,maxX=x,minY=y,maxY=y,area=0;
    while(qh<qt){
      const idx=queue[qh++], cy=Math.floor(idx/width), cx=idx-cy*width;
      area++;
      if(cx<minX)minX=cx;if(cx>maxX)maxX=cx;if(cy<minY)minY=cy;if(cy>maxY)maxY=cy;
      for(const [dx,dy] of neigh){
        const nx=cx+dx, ny=cy+dy;
        if(nx<0||ny<0||nx>=width||ny>=height)continue;
        const ni=ny*width+nx;
        if(mask[ni]&&labels[ni]===0){labels[ni]=label;queue[qt++]=ni;}
      }
    }
    comps.push({rawLabel:label,area,minX,minY,maxX,maxY});
  }

  const kept=comps.filter(c=>c.area>=minArea);
  kept.sort((a,b)=>(a.minY-b.minY)||(a.minX-b.minX));
  const remap=new Map();
  kept.forEach((c,i)=>{c.id=i+1;c.width=c.maxX-c.minX+1;c.height=c.maxY-c.minY+1;remap.set(c.rawLabel,c.id);});
  for(let i=0;i<n;i++) labels[i]=remap.get(labels[i])||0;
  self.postMessage({labelsBuffer:labels.buffer,components:kept,elapsed:performance.now()-t0},[labels.buffer]);
};
function dilate(mask,width,height,r){
  const out=new Uint8Array(mask.length),rsq=r*r;
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    if(!mask[y*width+x])continue;
    for(let yy=Math.max(0,y-r);yy<=Math.min(height-1,y+r);yy++){
      const dy=yy-y;
      for(let xx=Math.max(0,x-r);xx<=Math.min(width-1,x+r);xx++){
        const dx=xx-x;if(dx*dx+dy*dy<=rsq)out[yy*width+xx]=1;
      }
    }
  }
  return out;
}
