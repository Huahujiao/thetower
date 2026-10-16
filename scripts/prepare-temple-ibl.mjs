import { readFile, writeFile, mkdir, rename } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js'
import { FloatType } from 'three'

const root = new URL('../',import.meta.url)
const source = new URL('art/source/environment/kloofendal_overcast_puresky_1k.hdr',root)
const incoming = new URL('public/assets/environment/kloofendal_overcast_puresky_1k.hdr',root)
const output = new URL('src/assets/environment/kloofendal-overcast-puresky-128.hdr',root)
const manifestFile = new URL('art/reviews/temple-ibl-manifest.json',root)
const check = process.argv.includes('--check')
const parse = bytes => new HDRLoader().setDataType(FloatType).parse(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength))

function downsample(hdr,width) {
  const height=width/2, data=new Float32Array(width*height*4),scale=hdr.width/width
  if (!Number.isInteger(scale)||hdr.height!==hdr.width/2) throw new Error('Expected a larger 2:1 equirectangular HDR')
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const index=(y*width+x)*4;let weights=0
    // Filter scene-linear radiance with spherical pixel area weights. Never tone-map.
    for(let row=0;row<scale;row++){
      const sy=y*scale+row,weight=Math.cos(((sy+.5)/hdr.height-.5)*Math.PI)
      for(let col=0;col<scale;col++){
        const si=(sy*hdr.width+x*scale+col)*4
        for(let c=0;c<3;c++)data[index+c]+=hdr.data[si+c]*weight
        weights+=weight
      }
    }
    for(let c=0;c<3;c++)data[index+c]/=weights
    data[index+3]=1
  }
  return {width,height,data}
}
function encode(hdr) {
  const chunks=[Buffer.from('#?RADIANCE\n# Linear area-filtered Poly Haven sky; CC0\nFORMAT=32-bit_rle_rgbe\n\n-Y '+hdr.height+' +X '+hdr.width+'\n')]
  for(let y=0;y<hdr.height;y++){
    const channels=Array.from({length:4},()=>[])
    for(let x=0;x<hdr.width;x++){
      const index=(y*hdr.width+x)*4,m=Math.max(...hdr.data.subarray(index,index+3))
      const exponent=m>1e-32?Math.floor(Math.log2(m))+1:0,scale=m>1e-32?256/2**exponent:0
      for(let c=0;c<3;c++)channels[c].push(Math.min(255,Math.floor(hdr.data[index+c]*scale)))
      channels[3].push(m>1e-32?exponent+128:0)
    }
    const bytes=[2,2,hdr.width>>8,hdr.width&255]
    for(const channel of channels){
      let i=0
      const runAt=start=>{let n=1;while(start+n<channel.length&&n<127&&channel[start+n]===channel[start])n++;return n}
      while(i<channel.length){
        const run=runAt(i)
        if(run>=4){bytes.push(128+run,channel[i]);i+=run}
        else{
          const start=i;i+=run
          while(i<channel.length&&i-start<128){const next=runAt(i);if(next>=4)break;i+=Math.min(next,128-(i-start))}
          bytes.push(i-start,...channel.slice(start,i))
        }
      }
    }
    chunks.push(Buffer.from(bytes))
  }
  return Buffer.concat(chunks)
}
function irradiance(hdr){
  const directions=[[0,1,0],[0,-1,0],[1,0,0],[-1,0,0],[0,0,1],[0,0,-1],[.6,.8,0],[-.6,.8,0],[0,.8,.6],[0,.8,-.6]]
  const totals=directions.map(()=>[0,0,0])
  for(let y=0;y<hdr.height;y++){
    const latitude=(.5-(y+.5)/hdr.height)*Math.PI,ny=Math.sin(latitude),h=Math.cos(latitude),area=h*2*Math.PI*Math.PI/(hdr.width*hdr.height)
    for(let x=0;x<hdr.width;x++){
      const angle=((x+.5)/hdr.width-.5)*2*Math.PI,nx=Math.cos(angle)*h,nz=Math.sin(angle)*h,index=(y*hdr.width+x)*4
      directions.forEach(([dx,dy,dz],i)=>{const w=Math.max(0,dx*nx+dy*ny+dz*nz)*area;for(let c=0;c<3;c++)totals[i][c]+=hdr.data[index+c]*w})
    }
  }
  return totals.flat()
}
let bytes
try { bytes=await readFile(source) } catch { bytes=await readFile(incoming) }
const hdr=parse(bytes)
if(hdr.width!==1024||hdr.height!==512)throw new Error('Expected the downloaded 1K source')
const baseline=irradiance(hdr), candidates=[]
let chosen
for(const width of [128,256]){
  const encoded=encode(downsample(hdr,width)),decoded=parse(encoded),energy=irradiance(decoded)
  const maxDiffuseError=Math.max(...energy.map((value,i)=>Math.abs(value-baseline[i])/baseline[i]))
  const peak=Math.max(...Array.from({length:decoded.width*decoded.height},(_,i)=>decoded.data[i*4]*.2126+decoded.data[i*4+1]*.7152+decoded.data[i*4+2]*.0722))
  candidates.push({width,height:width/2,bytes:encoded.length,maxDiffuseError,peakLuminance:peak})
  if(width===128)chosen=encoded
}
const manifest={source:'https://polyhaven.com/a/kloofendal_overcast_puresky',author:'Greg Zaal',license:'CC0-1.0',sourceBytes:bytes.length,sourceSha256:createHash('sha256').update(bytes).digest('hex'),runtime:'src/assets/environment/kloofendal-overcast-puresky-128.hdr',runtimeSha256:createHash('sha256').update(chosen).digest('hex'),filter:'scene-linear RGB, spherical area average, Radiance RGBE RLE; no tone mapping',candidates}
if(check){
  if(!(await readFile(output)).equals(chosen))throw new Error('Compressed sky is stale')
  const old=JSON.parse(await readFile(manifestFile,'utf8'))
  if(old.runtimeSha256!==manifest.runtimeSha256||old.sourceSha256!==manifest.sourceSha256)throw new Error('IBL manifest is stale')
}else{
  await mkdir(new URL('art/source/environment/',root),{recursive:true})
  // Archive the exact, named source outside public so production ships only the small HDR.
  try{await readFile(source)}catch{await rename(incoming,source)}
  await writeFile(output,chosen)
  await writeFile(manifestFile,JSON.stringify(manifest,null,2)+'\n')
}
if(candidates.find(c=>c.width===128).maxDiffuseError>.02)throw new Error('Diffuse radiance changed by more than 2%')
console.log(JSON.stringify({verified:check,...manifest},null,2))
