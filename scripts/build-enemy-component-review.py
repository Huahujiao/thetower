"""Make contact sheets from the actual /animeedit screenshots (Pillow)."""
from pathlib import Path
import sys
from PIL import Image, ImageDraw

root = Path(__file__).resolve().parents[1] / 'art/generated/enemy-components-2026-10-01/review'
followup = '--gnawer-elbow' in sys.argv
resize = '--enemy-size' in sys.argv
batch2 = '--batch2' in sys.argv
batch3 = '--batch3' in sys.argv
batch4 = '--batch4' in sys.argv
fourth_ids = ['tidal-spore-sac', 'revenant-guard', 'bomb-wisp', 'cracked-hunter', 'broodling', 'leech-larva', 'tide-shadow']
third_ids = ['furnace-beetle', 'thorn-shell-flower', 'water-leech-swarm', 'whirlpool-eye-sac', 'cinder-curse-lamp-swarm', 'drown-shadow-hunter']
if batch2 or batch3 or batch4:
    root = root.parents[1] / f'enemy-components-batch{4 if batch4 else 3 if batch3 else 2}-2026-10-01/review'
if resize:
    root = root.parent / 'enemy-size-v12'
if followup:
    root = root.parent / 'gnawer-elbow-v11'
for enemy in (fourth_ids if batch4 else third_ids if batch3 else ['rot-walker', 'shellguard', 'wisp', 'moss-colossus', 'sentry-crossbow', 'ash-cannon-bug'] if batch2 else ['gnawer', 'tide-shadow-cub'] if resize else ['gnawer'] if followup else ['gnawer', 'emberwing-moth', 'rootrot-bud', 'tide-shadow-cub', 'nest-spider', 'beetle-guard']):
    sheet = Image.new('RGB', (1500, 1630), '#1b242d')
    draw = ImageDraw.Draw(sheet)
    draw.text((12, 8), enemy + f' / actual animeedit / component pack {15 if batch4 else 14 if batch3 else 13 if batch2 else 12 if resize else 11 if followup else 10}', fill='white')
    for row, action in enumerate(['idle', 'move', 'attack', 'hit', 'death']):
        for col, fraction in enumerate(['0', '0.27', '0.64', '0.85', '1']):
            source = root / f'editor-{enemy}-{action}-{fraction}.png'
            tile = Image.open(source).convert('RGB').resize((300, 300), Image.Resampling.LANCZOS)
            x, y = col * 300, 30 + row * 320
            sheet.paste(tile, (x, y))
            draw.text((x + 8, y + 301), f'{action} / {fraction}', fill='white')
    sheet.save(root / f'editor-{enemy}.png')
    print(root / f'editor-{enemy}.png')

if batch2 or batch3 or batch4:
    enemies = fourth_ids if batch4 else third_ids if batch3 else ['rot-walker', 'shellguard', 'wisp', 'moss-colossus', 'sentry-crossbow', 'ash-cannon-bug']
    overview = Image.new('RGB', (1320, ((len(enemies) + 2) // 3) * 468), '#1b242d')
    draw = ImageDraw.Draw(overview)
    for index, enemy in enumerate(enemies):
        tile = Image.open(root / f'editor-{enemy}-idle-0.png').convert('RGB')
        x, y = index % 3 * 440, index // 3 * 468
        overview.paste(tile.resize((440, 440)), (x, y))
        draw.text((x + 12, y + 447), enemy, fill='white')
    overview.save(root / 'overview.png')
    if all((root / f'orbit-{enemy}-{view}.png').exists() for enemy in enemies for view in range(3)):
        orbit_sheet = Image.new('RGB', (660, len(enemies) * 248), '#1b242d')
        draw = ImageDraw.Draw(orbit_sheet)
        for row, enemy in enumerate(enemies):
            for view in range(3):
                tile = Image.open(root / f'orbit-{enemy}-{view}.png').convert('RGB')
                x, y = view * 220, row * 248
                orbit_sheet.paste(tile.resize((220, 220)), (x, y))
                draw.text((x + 8, y + 226), f'{enemy} / {view}', fill='white')
        orbit_sheet.save(root / 'orbit-overview.png')
