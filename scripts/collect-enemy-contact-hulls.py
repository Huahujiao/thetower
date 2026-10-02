"""Bake opaque-pixel hulls, including atlas crops, for floor constraints."""
import json
import subprocess
from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parents[1]
parts = json.loads(subprocess.check_output(['node', '--input-type=module', '-e', "import {createEnemyShadowProjects} from './src/animation/shadow-enemies.js'; console.log(JSON.stringify(createEnemyShadowProjects().flatMap(p=>p.parts)))"], cwd=root).decode('utf-8'))
result = {}
def hull(points):
    def cross(o, a, b): return (a[0]-o[0])*(b[1]-o[1])-(a[1]-o[1])*(b[0]-o[0])
    lower, upper = [], []
    for p in sorted(set(points)):
        while len(lower) >= 2 and cross(lower[-2], lower[-1], p) <= 0: lower.pop()
        lower.append(p)
    for p in sorted(set(points), reverse=True):
        while len(upper) >= 2 and cross(upper[-2], upper[-1], p) <= 0: upper.pop()
        upper.append(p)
    return lower[:-1] + upper[:-1]
for part in parts:
    visual = part['visual']
    if visual['type'] != 'texture': continue
    frame = visual.get('textureFrame', {})
    key = visual['texture'] + '|' + json.dumps(frame, separators=(',', ':'), ensure_ascii=False)
    if key in result: continue
    image = Image.open(root / 'public' / visual['texture'].lstrip('/')).convert('RGBA')
    cw, ch = image.width / frame.get('columns', 1), image.height / frame.get('rows', 1)
    crop = frame.get('crop', dict(left=0, top=0, width=1, height=1))
    x, y = (frame.get('column', 0)+crop['left'])*cw, (frame.get('row', 0)+crop['top'])*ch
    w, h = cw*crop['width'], ch*crop['height']
    points = []
    alpha = image.getchannel('A')
    for row in range(max(0, int(y)), min(image.height, int(y+h)+1)):
        pixels = [col for col in range(max(0, int(x)), min(image.width, int(x+w)+1)) if alpha.getpixel((col,row)) > 8]
        if pixels:
            for col in (pixels[0], pixels[-1]+1):
                points.extend([(col,row), (col,row+1)])
    result[key] = [[round((px-x)/w, 6), round((py-y)/h, 6)] for px,py in hull(points)]
(root / 'src/animation/enemy-contact-hulls.json').write_text(json.dumps(result, ensure_ascii=False, separators=(',', ':'))+'\n', encoding='utf-8')
print(f'Baked {len(result)} opaque texture hulls.')
