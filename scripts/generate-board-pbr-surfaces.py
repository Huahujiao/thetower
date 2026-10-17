"""Linear PBR data derived from existing artwork, not measured scans or baked scene AO."""
from pathlib import Path
import argparse
import importlib.util
import numpy as np
from PIL import Image, ImageFilter
ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / 'src/assets'
spec = importlib.util.spec_from_file_location('card_normals', ROOT / 'scripts/generate-card-back-normals.py')
card = importlib.util.module_from_spec(spec)
spec.loader.exec_module(card)

def blur(a, radius):
    return np.asarray(Image.fromarray(np.uint8(np.clip(a,0,1)*255)).filter(ImageFilter.GaussianBlur(radius)), dtype=np.float32)/255

def smooth(a, lo, hi):
    t=np.clip((a-lo)/(hi-lo),0,1)
    return t*t*(3-2*t)

def maps():
    for kind, (source, low, high) in card.BACKS.items():
        image = Image.open(ASSETS / source).convert('RGB').resize((512,512), Image.Resampling.LANCZOS)
        _, height = card.relief_normal(image, low, high)
        raised = np.clip(height/.9,0,1)
        rgb = np.asarray(image,dtype=np.float32)/255
        luma = rgb @ np.array([.2126,.7152,.0722])
        grain = np.clip((blur(luma,.7)-blur(luma,3))*2,-.08,.08)
        # Matte relief follows the raised ornament without a metallic finish.
        inlay = smooth(raised,.06,.65)
        rough = np.clip(.86-inlay*.12+grain*.4,.70,.90)
        metal = np.zeros_like(inlay)
        ao = 1-np.clip((blur(height,2)-height)*.5,0,.16)
        yield 'board-card-back-'+kind+'-surface-v1.png', np.uint8(np.stack([ao,rough,metal],axis=-1)*255+.5)
    for kind in ['a','b','c','d']:
        image = Image.open(ASSETS / ('board-floor-temple-'+kind+'-v4.jpg')).convert('RGB').resize((512,512),Image.Resampling.LANCZOS)
        rgb=np.asarray(image,dtype=np.float32)/255
        luma=rgb @ np.array([.2126,.7152,.0722])
        height=(blur(luma,.7)-blur(luma,5))*.7+(blur(luma,3)-blur(luma,15))*.18
        dy,dx=np.gradient(height)
        n=np.stack([-dx*14,dy*14,np.ones_like(dx)],axis=-1)
        n/=np.linalg.norm(n,axis=-1,keepdims=True)
        n[[0,-1],:]=[0,0,1];n[:,[0,-1]]=[0,0,1]
        yield 'board-floor-'+kind+'-normal-v1.png',np.uint8((n*.5+.5)*255+.5)
        # Restrained mineral wear; avoid binary shiny/matte islands on a cloudy sky.
        local=blur(luma,3)
        low,high=np.quantile(local,[.12,.88])
        wear=smooth(local,low,high)
        cavity=1-smooth(blur(luma,.7),.045,.14)
        rough=np.clip(.50-wear*.14+cavity*.20,.36,.72)
        assert np.quantile(rough,.1)<.40 and np.quantile(rough,.9)>.50, 'Floor needs polished mineral and rough recessed cracks'
        yield 'board-floor-'+kind+'-surface-v1.png',np.uint8(np.stack([1-cavity*.12,rough,np.zeros_like(rough)],axis=-1)*255+.5)

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--check',action='store_true');args=parser.parse_args()
    count=0
    for name,pixels in maps():
        target=ASSETS/name
        if args.check:
            actual=Image.open(target)
            assert actual.mode=='RGB' and actual.size==(512,512),name
            assert np.array_equal(np.asarray(actual),pixels),'Stale map: '+name
        else: Image.fromarray(pixels).save(target,optimize=True)
        if 'surface' in name:
            assert np.ptp(pixels[:,:,1])>20,name
            assert pixels[:,:,0].min()>=210,name
        count+=1
    print(str(count)+' board PBR maps '+('verified' if args.check else 'generated'))
if __name__=='__main__':main()
