"""Offline geometry/material inspection, NOT a browser or game screenshot.
Rasterizes the exported production meshes with their actual UVs and surface data.
"""
from pathlib import Path
import argparse, gzip, json, math, os
import numpy as np
from PIL import Image, ImageDraw, ImageFont
ROOT=Path(__file__).resolve().parents[1]
os.environ.setdefault('NUMBA_CACHE_DIR', str(ROOT / 'tmp/architecture-review/numba-cache'))
from numba import njit

@njit(cache=True)
def sample(tex,u,v):
    h,w=tex.shape[:2]
    x=(u%1)*w-.5;y=((1-v)%1)*h-.5
    ix=int(math.floor(x));iy=int(math.floor(y));fx=x-ix;fy=y-iy
    return (tex[iy%h,ix%w]*(1-fx)+tex[iy%h,(ix+1)%w]*fx)*(1-fy)+(tex[(iy+1)%h,ix%w]*(1-fx)+tex[(iy+1)%h,(ix+1)%w]*fx)*fy

@njit(cache=True)
def raster(points,normals,uvs,colors,mids,casts,materials,maps,nmaps,smaps,params,lighting,basis,centre,scale,width,height,light_basis,light_depth,shadow=False):
    depths=np.full((height,width),1e8,np.float64)
    out=np.zeros((height,width,3),np.float64)
    world=np.zeros((height,width,3),np.float64)
    valid=np.zeros((height,width),np.uint8)
    light=lighting[:3].copy();light/=np.linalg.norm(light)
    for tri in range(len(points)):
        p=points[tri];normal=normals[tri];uv=uvs[tri];color=colors[tri]
        if shadow and not casts[tri]:continue
        edge1=p[1]-p[0];edge2=p[2]-p[0]
        geo=np.cross(edge1,edge2)
        if np.dot(geo,basis[2])>=0:continue
        screen=np.empty((3,3),np.float64)
        for k in range(3):
            rel=p[k]-centre
            screen[k,0]=width/2+np.dot(rel,basis[0])*scale
            screen[k,1]=height/2-np.dot(rel,basis[1])*scale
            screen[k,2]=np.dot(rel,basis[2])
        a,b,c=screen
        det=(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])
        if abs(det)<1e-7:continue
        x0=max(0,int(math.floor(min(a[0],b[0],c[0]))));x1=min(width-1,int(math.ceil(max(a[0],b[0],c[0]))))
        y0=max(0,int(math.floor(min(a[1],b[1],c[1]))));y1=min(height-1,int(math.ceil(max(a[1],b[1],c[1]))))
        du1=uv[1]-uv[0];du2=uv[2]-uv[0];uvdet=du1[0]*du2[1]-du2[0]*du1[1]
        tangent=np.array([1.,0.,0.]);bitangent=np.array([0.,1.,0.])
        if abs(uvdet)>1e-8:
            tangent=(edge1*du2[1]-edge2*du1[1])/uvdet
            bitangent=(edge2*du1[0]-edge1*du2[0])/uvdet
        mi=mids[tri]
        for y in range(y0,y1+1):
            for x in range(x0,x1+1):
                px=x+.5;py=y+.5
                w1=((px-a[0])*(c[1]-a[1])-(py-a[1])*(c[0]-a[0]))/det
                w2=((b[0]-a[0])*(py-a[1])-(b[1]-a[1])*(px-a[0]))/det
                w0=1-w1-w2
                if min(w0,w1,w2)<-1e-5:continue
                z=w0*a[2]+w1*b[2]+w2*c[2]
                if z>=depths[y,x]:continue
                depths[y,x]=z
                if shadow:continue
                pos=w0*p[0]+w1*p[1]+w2*p[2]
                n=w0*normal[0]+w1*normal[1]+w2*normal[2];n/=max(np.linalg.norm(n),1e-6)
                coord=w0*uv[0]+w1*uv[1]+w2*uv[2]
                albedo=materials[mi]*(w0*color[0]+w1*color[1]+w2*color[2])
                if params[mi,0]>=0:albedo*=sample(maps[int(params[mi,0])],coord[0],coord[1])
                rough=params[mi,3];ao=1.
                if params[mi,2]>=0:
                    surface=sample(smaps[int(params[mi,2])],coord[0],coord[1]);rough*=surface[1];ao=1-(1-surface[0])*params[mi,5]
                if params[mi,1]>=0:
                    nm=sample(nmaps[int(params[mi,1])],coord[0],coord[1])*2-1
                    nm[0]*=params[mi,4];nm[1]*=params[mi,4]
                    t=tangent-n*np.dot(n,tangent);t/=max(np.linalg.norm(t),1e-6)
                    bt=np.cross(n,t)
                    if np.dot(bt,bitangent)<0:bt=-bt
                    n=t*nm[0]+bt*nm[1]+n*nm[2];n/=max(np.linalg.norm(n),1e-6)
                shade=1.
                lpos=light_basis@pos
                lx=int(640+lpos[0]*55);ly=int(640-lpos[1]*55)
                if 1<=lx<1279 and 1<=ly<1279:
                    occ=0.
                    for oy in range(-1,2):
                        for ox in range(-1,2):
                            if lpos[2]>light_depth[ly+oy,lx+ox]+.024:occ+=1
                    shade=1-occ/9*.72
                hemi=(n[1]+1)*.5
                ambient=np.array([.24,.31,.34])*(.45+hemi*.7)*lighting[4]
                ambient+=lighting[5:8]
                diffuse=max(0,np.dot(n,light))*.87*lighting[3]*shade*np.array([1.,.94,.83])
                halfv=light-basis[2];halfv/=np.linalg.norm(halfv)
                spec=max(0,np.dot(n,halfv))**(8+(1-rough)*70)*(.025+(1-rough)*.06)*shade
                fill=np.array([4.,5.,6.]);fill/=np.linalg.norm(fill)
                fill_diffuse=max(0,np.dot(n,fill))*.06
                lit=albedo*(ambient+diffuse+fill_diffuse)*ao+spec*lighting[3]
                if params[mi,6]>.5:
                    stoneh=-.43+(pos[1]+.43)/4.5
                    t=min(1.,max(0.,(stoneh+2.65)/1.8));t=t*t*(3-2*t)
                    lit*=.34+.66*t
                out[y,x]=lit
                world[y,x]=pos;valid[y,x]=1
    return out,depths,world,valid

def basis_for(eye,target):
    forward=np.asarray(target,dtype=float)-eye;forward/=np.linalg.norm(forward)
    right=np.cross(forward,np.array([0.,1.,0.]));right/=np.linalg.norm(right)
    up=np.cross(right,forward)
    return np.array([right,up,forward],dtype=np.float64)

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--source',default='tmp/architecture-review/scene.json.gz');parser.add_argument('--out',default='art/reviews/temple-architecture-pass1');args=parser.parse_args()
    scene=json.loads(gzip.decompress((ROOT/args.source).read_bytes()))
    def tex(path,linear):
        a=np.asarray(Image.open(ROOT/path).convert('RGB').resize((512,512),Image.Resampling.LANCZOS),dtype=np.float64)/255
        return a if linear else np.where(a<=.04045,a/12.92,((a+.055)/1.055)**2.4)
    paths=[sorted(set(m[key] for m in scene['materials'] if m[key])) for key in ['map','normal','surface']]
    stacks=[np.stack([tex(p,i>0) for p in group]) if group else np.ones((1,512,512,3),np.float64) for i,group in enumerate(paths)]
    materials=np.array([m['color'] for m in scene['materials']],np.float64)
    params=np.array([[paths[i].index(m[key]) if m[key] else -1 for i,key in enumerate(['map','normal','surface'])]+[m['roughness'],m['normalScale'],m['ao'],int(m['depth'])] for m in scene['materials']],np.float64)
    points=[];normals=[];uvs=[];colors=[];mids=[];casts=[]
    for mesh in scene['meshes']:
        p=np.asarray(mesh['positions'],np.float64).reshape(-1,3,3)
        points.append(p);normals.append(np.asarray(mesh['normals'],np.float64).reshape(-1,3,3));uvs.append(np.asarray(mesh['uv'],np.float64).reshape(-1,3,2))
        colors.append(np.asarray(mesh['colors'],np.float64).reshape(-1,3,3) if mesh['colors'] else np.ones_like(p));mids.extend([mesh['material']]*len(p));casts.extend([mesh['shadow']]*len(p))
    arrays=[np.concatenate(a) for a in [points,normals,uvs,colors]]+[np.asarray(mids,np.int32),np.asarray(casts,np.bool_),materials,*stacks,params]
    config=scene.get('lighting',{'keyPosition':[5.,10.,6.],'keyIntensity':1.5,'skyIntensity':1.3})
    ambient_hex=config.get('ambientColor',0xffffff)
    ambient_rgb=np.array([(ambient_hex>>16)&255,(ambient_hex>>8)&255,ambient_hex&255],dtype=np.float64)/255
    ambient_rgb=np.where(ambient_rgb<=.04045,ambient_rgb/12.92,((ambient_rgb+.055)/1.055)**2.4)
    ambient_rgb*=config.get('ambientIntensity',0)/math.pi
    lighting=np.asarray(config['keyPosition']+[config['keyIntensity']/1.5,config['skyIntensity']/1.3]+list(ambient_rgb),np.float64)
    light_basis=basis_for(lighting[:3],np.zeros(3))
    dummy=np.zeros((1280,1280),np.float64)
    _,light_depth,_,_=raster(*arrays,lighting,light_basis,np.zeros(3),55.,1280,1280,light_basis,dummy,True)
    views=[('overview',np.array([9.,10.,13.]),np.array([0.,-.4,0.]),66.,1100,900),('front',np.array([0.,6.,10.]),np.array([0.,-.4,0.]),83.,1100,900),('corner',np.array([8.,4.,8.]),np.array([3.3,.2,2.5]),230.,1100,850),('doors',np.array([8.,4.,1.]),np.array([3.75,.45,0.]),250.,1100,850),('gate',np.array([-8.,3.,5.]),np.array([-3.76,.65,0.]),295.,1100,850)]
    for name,eye,target,scale,w,h in views:
        basis=basis_for(eye,target)
        rgb,depth,world,valid=raster(*arrays,lighting,basis,target,scale,w,h,light_basis,light_depth)
        # Screen-space contact shading for inspection, not part of game material.
        occ=np.zeros((h,w),np.float64)
        for dx,dy in [(-4,0),(4,0),(0,-4),(0,4),(-7,-7),(7,-7),(-7,7),(7,7)]:
            other=np.roll(np.roll(world,dy,axis=0),dx,axis=1);d=np.roll(np.roll(depth,dy,axis=0),dx,axis=1)
            near=np.linalg.norm(other-world,axis=-1)<.22
            occ+=((depth-d>.015)&near&valid.astype(bool)&np.roll(np.roll(valid,dy,axis=0),dx,axis=1).astype(bool))*.035
        rgb*=np.maximum(.7,1-occ)[:,:,None]
        # Desaturated background like the temple's sky, without decorative props.
        bg=np.array([.032,.052,.059]);rgb=np.where(valid[:,:,None],rgb,bg)
        rgb=np.clip(np.where(rgb<=.0031308,rgb*12.92,1.055*np.maximum(rgb,0)**(1/2.4)-.055),0,1)
        image=Image.fromarray(np.uint8(rgb*255+.5))
        draw=ImageDraw.Draw(image);draw.rectangle((0,0,w,42),fill='#172429');draw.text((16,13),'PRODUCTION MESH / OFFLINE MATERIAL STUDY - '+name,fill='#d5d4bf')
        path=ROOT/(args.out+'-'+name+'.png');path.parent.mkdir(parents=True,exist_ok=True);image.save(path)
        print(path.relative_to(ROOT))
if __name__=='__main__':main()
