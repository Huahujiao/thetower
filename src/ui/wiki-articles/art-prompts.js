export default `# 当前美术生成提示词

仅保留当前接入的石板与牌背提示词，删除旧地砖和未接入图集的制作记录。隐藏牌仍统一使用中性卡背，不通过属性牌背泄露内容。

## Stoneshard-reference dungeon floor — current integration, 2026-09-16

Generated with the built-in image model using \`screenshots/stoneshard_floor.jpg\` as the reference (2 rows by 7 cells). Four independent single-cell masters: \`art/generated/floor-dungeon-{a,b,c,d}-v1.png\`. Runtime files: \`src/assets/board-floor-dungeon-{a,b,c,d}-v1.jpg\`, exported with \`scripts/export-board-art.ps1\`. Cool dark teal-gray palette is kept without runtime brightness adjustment. Coordinate-hashed distribution: intact 50%, fractured 20%, chipped 20%, four-block 10%; these are selection weights, not guaranteed per-room counts. No gameplay RNG or redraw reshuffling.

### Variant A

Prompt: Use case: stylized-concept. Production game dungeon floor texture. Attached image is a low-resolution STYLE, COLOR and SCALE reference showing TWO ROWS BY SEVEN COLUMNS of game cells. Your output is ONE single SQUARE CELL ONLY, NOT the whole 2x7 scene, NOT an atlas. Match its dark desaturated blue-green charcoal stone palette (roughly #253332 shadow stone, #354342 raised planes, #142222 joints), low contrast, simplified broad chipped stone planes and chunky hand-painted PIXEL ART marks, deliberate restrained pixel clusters, gritty abandoned dungeon feeling. Top-down orthographic, flat tile with very thin irregular dark mortar at the outer edges. The ONE CELL is mostly one large squared stone slab, not rows of tiny bricks. Even ambient illumination, no central shine, no perspective, no extrusion, no cast shadow, no vignette. Stone at all boundaries stays same palette as reference; repeatable as a grid of neighboring independent floor cells. Surface readable at 52x52 px. No ornament, border frame, emblems, writing, grass, objects, crystals or purple glow. Opaque square full-frame texture. Variant A: a single largely intact slab with broad quiet dark cool-gray planes, tiny scattered pits and lightly chipped perimeter.

### Variant B

Prompt: Use case: stylized-concept. Production game dungeon floor texture. Attached image is a low-resolution STYLE, COLOR and SCALE reference showing TWO ROWS BY SEVEN COLUMNS of game cells. Your output is ONE single SQUARE CELL ONLY, NOT the whole 2x7 scene, NOT an atlas. Match its dark desaturated blue-green charcoal stone palette (roughly #253332 shadow stone, #354342 raised planes, #142222 joints), low contrast, simplified broad chipped stone planes and chunky hand-painted PIXEL ART marks, deliberate restrained pixel clusters, gritty abandoned dungeon feeling. Top-down orthographic, flat tile with very thin irregular dark mortar at the outer edges. The ONE CELL is mostly one large squared stone slab, not rows of tiny bricks. Even ambient illumination, no central shine, no perspective, no extrusion, no cast shadow, no vignette. Stone at all boundaries stays same palette as reference; repeatable as a grid of neighboring independent floor cells. Surface readable at 52x52 px. No ornament, border frame, emblems, writing, grass, objects, crystals or purple glow. Opaque square full-frame texture. Variant B: a single slab with ONE subtle angular hairline fracture crossing the lower half, broad quiet planes, consistent palette and edge width.

### Variant C

Prompt: Use case: stylized-concept. Production game dungeon floor texture. Attached image is a low-resolution STYLE, COLOR and SCALE reference showing TWO ROWS BY SEVEN COLUMNS of game cells. Your output is ONE single SQUARE CELL ONLY, NOT the whole 2x7 scene, NOT an atlas. Match its dark desaturated blue-green charcoal stone palette (roughly #253332 shadow stone, #354342 raised planes, #142222 joints), low contrast, simplified broad chipped stone planes and chunky hand-painted PIXEL ART marks, deliberate restrained pixel clusters, gritty abandoned dungeon feeling. Top-down orthographic, flat tile with very thin irregular dark mortar at the outer edges. The ONE CELL is mostly one large squared stone slab, not rows of tiny bricks. Even ambient illumination, no central shine, no perspective, no extrusion, no cast shadow, no vignette. Stone at all boundaries stays same palette as reference; repeatable as a grid of neighboring independent floor cells. Surface readable at 52x52 px. No ornament, border frame, emblems, writing, grass, objects, crystals or purple glow. Opaque square full-frame texture. Variant C: a single slab with a small broken corner at upper right and two small matching stone chips tightly filling that corner; no large hole, keep at least 80 percent large slab.

### Variant D

Prompt: Use case: stylized-concept. Production game dungeon floor texture. Attached image is a low-resolution STYLE, COLOR and SCALE reference showing TWO ROWS BY SEVEN COLUMNS of game cells. Your output is ONE single SQUARE CELL ONLY, NOT the whole 2x7 scene, NOT an atlas. Match its dark desaturated blue-green charcoal stone palette (roughly #253332 shadow stone, #354342 raised planes, #142222 joints), low contrast, simplified broad chipped stone planes and chunky hand-painted PIXEL ART marks, deliberate restrained pixel clusters, gritty abandoned dungeon feeling. Top-down orthographic, flat tile with very thin irregular dark mortar at the outer edges. The ONE CELL is mostly one large squared stone slab, not rows of tiny bricks. Even ambient illumination, no central shine, no perspective, no extrusion, no cast shadow, no vignette. Stone at all boundaries stays same palette as reference; repeatable as a grid of neighboring independent floor cells. Surface readable at 52x52 px. No ornament, border frame, emblems, writing, grass, objects, crystals or purple glow. Opaque square full-frame texture. Variant D: replace the one large slab with FOUR uneven quarter-size square flagstone blocks, divided by thin irregular perpendicular mortar joints, consistent palette; only four blocks, no more.


## Independent colored card backs — current integration

Built-in image generation produced three separate finished textures using \`card-back-neutral-v1.png\` as the style/layout reference:

- \`art/generated/card-back-scorch-v1.png\`: cinnabar flame ornament.
- \`art/generated/card-back-wither-v1.png\`: ochre root ornament.
- \`art/generated/card-back-drown-v1.png\`: indigo water ornament.

The corresponding runtime JPEGs are \`src/assets/board-card-back-{scorch,wither,drown}-v1.jpg\`. Neutral uses \`src/assets/board-card-back-v1.jpg\`. All are exported at 1024 square, JPEG quality 88, using \`scripts/export-board-art.ps1\`.

The renderer now copies these complete images into cached textures without tinting, central icons, or extra borders. Only blocked cards receive a 28% dark overlay. The older single-master tint-and-icon experiment described below is superseded. Floor textures also retain their source colors without the former desaturation/darkening filter.

### scorch

Use case: stylized-concept. Generate ONE square game card-back texture, flat orthographic top-down, edge-to-edge, no perspective or thickness. Reference image is a STYLE and LAYOUT reference, not an atlas. Match its Chinese antique ink woodblock, mineral pigment, old lacquer, tactile rubbed grain, thin double-line geometric Chinese border, corner clouds, circular central ornamental seal. It must have clearly visible rich hand-painted ornament at small game tile sizes, with moderate contrast between lighter antique-gold lines and colored lacquer. This is a FINISHED colored card back used directly as a texture, not a blank icon background. No letters, text, numbers, pseudo-writing, UI icons, symbols stamped over the artwork, creatures, Japanese crests, watermark, multiple tiles, perspective, shadows, or scene. Single square opaque tile. Cinnabar red burnt-lacquer base. Central circular seal formed by curling flame and ember-cloud motifs, intricate Chinese flame scrolls integrated into ornament; dark red and muted copper/gold, visibly red throughout.

### wither

Use case: stylized-concept. Generate ONE square game card-back texture, flat orthographic top-down, edge-to-edge, no perspective or thickness. Reference image is a STYLE and LAYOUT reference, not an atlas. Match its Chinese antique ink woodblock, mineral pigment, old lacquer, tactile rubbed grain, thin double-line geometric Chinese border, corner clouds, circular central ornamental seal. It must have clearly visible rich hand-painted ornament at small game tile sizes, with moderate contrast between lighter antique-gold lines and colored lacquer. This is a FINISHED colored card back used directly as a texture, not a blank icon background. No letters, text, numbers, pseudo-writing, UI icons, symbols stamped over the artwork, creatures, Japanese crests, watermark, multiple tiles, perspective, shadows, or scene. Single square opaque tile. Ochre yellow and aged bronze base. Central circular seal formed by withered branching roots and dry leaf veins, restrained decay cracks; dusty mustard-gold and dark umber, visibly yellow throughout, no green.

### drown

Use case: stylized-concept. Generate ONE square game card-back texture, flat orthographic top-down, edge-to-edge, no perspective or thickness. Reference image is a STYLE and LAYOUT reference, not an atlas. Match its Chinese antique ink woodblock, mineral pigment, old lacquer, tactile rubbed grain, thin double-line geometric Chinese border, corner clouds, circular central ornamental seal. It must have clearly visible rich hand-painted ornament at small game tile sizes, with moderate contrast between lighter antique-gold lines and colored lacquer. This is a FINISHED colored card back used directly as a texture, not a blank icon background. No letters, text, numbers, pseudo-writing, UI icons, symbols stamped over the artwork, creatures, Japanese crests, watermark, multiple tiles, perspective, shadows, or scene. Single square opaque tile. Deep indigo and slate-blue lacquer base. Central circular seal formed by spiraling water currents and traditional Chinese cloud-wave motifs; weathered blue and pale antique gold, visibly blue throughout.


## Card back master v1 — integrated batch

- Tool: built-in image generation.
- New master: \`art/generated/card-back-neutral-v1.png\`.
- Style references: \`floor-tiles-v1.png\` and \`card-plates-v1.png\`; not edit targets.
- Runtime export: \`src/assets/board-card-back-v1.jpg\`, 1024 square, JPEG quality 88.
- Existing floor master exported to \`src/assets/board-floor-atlas-v1.jpg\` with the same settings.
- Re-export command: \`powershell -NoProfile -ExecutionPolicy Bypass -File scripts/export-board-art.ps1\`.
- Renderer samples the top-left and bottom-right dark floor tiles. Colored wave tiles remain unused.
- Card color, central attribute symbols, and blocked-state dimming are drawn at runtime. Originals stay unchanged.
- Original prompt:

Use case: stylized-concept. Asset type: ONE square production texture for the BACK of hidden cards in a Chinese folk-horror dungeon board game. Image 1 and Image 2 are STYLE REFERENCES ONLY, do not reproduce their atlas layouts. Generate a single square tile filling the image edge to edge, directly top-down orthographic, NO perspective, NO thickness, NO shadows, no surrounding scene. Antique mineral pigments, hand-inked woodblock lines, worn lacquer and subtle paper fibers, matching references. Almost monochromatic neutral charcoal and warm muted gray, NOT saturated color: the game applies cinnabar, ochre and indigo tints at runtime. Thin balanced double-line geometric Chinese border at 4% inset, delicate restrained cloud scrolls in the corners, a faint closed circular ritual seal in the center with abstract interlocking cloud lines, never resembling readable letters. Eerie restrained Chinese tower mystery. Center must remain low contrast with generous negative space for a small dynamic attribute symbol, artwork still legible at 100 pixels. Fine wear, softly rubbed pigment, no loud crack pattern, no large bright cream frame. Preserve equal margins on all four sides. No text, numbers, pseudo-writing, Japanese crests, creatures, eyes, weapons, UI, watermarks, grids, or multiple panels. Single flat square card back, fully opaque.


Reference images for both generations:

- \`art/fullscene1.png\`
- \`art/fullscene2.png\`

`
