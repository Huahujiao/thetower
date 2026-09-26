export default `# Enemy puppet texture batch

The three sample monsters in \`/animeedit\` now have transparent sprites on **every part**: 12/12 Bell Pilgrim, 19/19 Tide-Eye Spider Mother, and 11/11 Stitched-Belly Lantern Moth. Their original animated bones, depth, size, and part transforms remain unchanged. The left and right moth wings still use separate outward-facing artwork.

| Sample | Textured parts | Runtime assets |
| --- | --- | --- |
| Bell Pilgrim | all 12: robe, ribcage, skull, mouth, eye, two arms, claw, bell, bell mouth, two legs | Existing four sprites, \`bell-pilgrim-mouth-v2-small.png\`, and \`bell-pilgrim-{eye,arm,claw,bell-mouth,leg}-v1-small.png\` |
| Tide-Eye Spider Mother | all 19: body, head, abdomen, abdomen mark, three eyes, twelve leg segments | Existing four sprites plus \`tide-spider-{body,abdomen-mark,eye}-v1-small.png\` |
| Stitched-Belly Lantern Moth | all 11: thorax, lantern head, eye, two wing membranes, two wing eyes, abdomen, tail glow, two antennae | Existing five sprites plus \`lantern-moth-{eye,wing-eye,tail-glow,antenna}-v1-small.png\` |

The first seven larger parts have \`-small.png\` and \`-medium.png\` variants under \`public/assets/enemies/\`; the editor uses medium. The six newer, genuinely tiny parts ship only a 128px-max \`-small.png\` variant, and the editor uses that small version without progressive replacement. Cropped production sources and uncropped originals are backed up under \`src/assets/enemies/backup/source/\`, outside Vite's served \`public\` tree. The earlier shared vertical moth wing (\`lantern-moth-wing-v1\`) is retained for compatibility and is no longer the sample default.

Example-pack migration version 5 updates only moth wing parts that still point to the earlier shared default URL. A custom wing image remains untouched. It also fills the new head textures only where the matching example part still has an empty shape visual; deleted parts remain deleted in version-4-and-later saves. All changes share the existing per-part \`visual\` data, localStorage autosave, and Undo.

Version 6 fills the six previously textured part types only where the matching existing example still has its unchanged shape appearance; custom images and recolored shapes remain untouched. The spider upper/lower leg textures each serve all six matching bone-attached segments. These thin strips use centered \`cover\` fitting to retain the authored leg length inside the narrow bone-part boxes; larger parts use \`contain\`. The texture gallery is a horizontal swipe strip so the fixed-height editor panel does not grow as presets are added.

Version 7 fills the remaining 19 untextured part instances with 13 new reusable sprite designs. It only updates existing example parts that still have the original shape and colors; custom images, recolored parts, and deleted parts are preserved. In particular, the moth's \`eye\` uses its own lampwick sprite rather than the pilgrim's eye. The three new generated component sheets and a separate pilgrim leg source are backed up under \`src/assets/enemies/backup/sheets/\`; \`python scripts/split-enemy-component-sheets.py\` deterministically cuts and reduces them to 128px-max runtime sprites. The leg source was generated vertically and turned sideways at cutting time to preserve an unmistakable foot. The bell's dark aperture is cut from its component cell. \`npm run check:animation\` verifies all 42 part texture URLs resolve to real files.

The Texture tab filters preset sprites to the selected sample monster: 10 pilgrim, 7 spider, or 9 moth presets. Switching characters updates this list reactively. A blank custom character still sees all 26 presets so its parts can borrow from any sample; the manual texture path remains available for every character.

Version 8 replaces only the Bell Pilgrim's old default \`bell-pilgrim-mouth-v1-small.png\` with a shorter, near-frontal \`bell-pilgrim-mouth-v2-small.png\`; the old asset remains as a backup. A previously saved example using the old default URL migrates to v2, while custom mouth textures, part placement, and bone data remain unchanged. The generated v2 source is at \`src/assets/enemies/backup/source/bell-pilgrim-mouth-v2.png\`, with an uncropped backup beside it. Rebuild its runtime sprite with \`python scripts/generate-sprite-resolutions.py --root public/assets/enemies --source-root src/assets/enemies/backup/source --only bell-pilgrim-mouth-v2 --trim-transparent --backup-original --alpha-threshold 8 --small-edge 128 --small-only\`.

To regenerate sizes after editing a source, run \`python scripts/generate-sprite-resolutions.py --root public/assets/enemies --source-root src/assets/enemies/backup/source --only NAME\`, where \`NAME\` is the source filename without \`.png\`.
For a tiny part, add \`--small-edge 128 --small-only\`.
`
