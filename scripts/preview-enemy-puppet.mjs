import { readFileSync, writeFileSync } from 'node:fs'
import { Matrix4 } from 'three'
import { createEnemyShadowProjects } from '../src/animation/shadow-enemies.js'
import { evaluateShadowProject } from '../src/animation/shadow-rig.js'
import { projectShadowFaces } from '../src/animation/shadow-projection.js'

const enemyId = process.argv[2] || 'gnawer'
const action = process.argv[3] || 'idle'
const destination = process.argv[4] || `preview-${enemyId}.svg`
const fraction = Number(process.argv[5] || .5)
const yaw = Number(process.argv[6] || 0) * Math.PI / 180
const elevation = Number(process.argv[7] || 0) * Math.PI / 180
const project = createEnemyShadowProjects().find((entry) => entry.enemyId === enemyId)
if (!project) throw new Error(`Unknown enemy: ${enemyId}`)
const evaluated = evaluateShadowProject(project, action, project.animations[action].duration * fraction)
const view = new Matrix4().makeRotationX(elevation).multiply(new Matrix4().makeRotationY(yaw))
for (const entry of evaluated.parts) entry.matrix.premultiply(view)
const faces = projectShadowFaces(evaluated)
const commands = faces.map((face) => ({ ...face, svg: `<polygon points="${face.points.map((p) => `${p.x},${p.y}`).join(' ')}" fill="${face.fill}" stroke="${face.fill}" stroke-width=".3" opacity="${face.opacity}"/>` }))
for (const entry of evaluated.parts.filter(({ part }) => part.visual.type === 'texture')) {
  const { part, matrix, opacity } = entry
  const bytes = readFileSync(new URL(`../public${part.visual.texture}`, import.meta.url))
  const imageWidth = bytes.readUInt32BE(16), imageHeight = bytes.readUInt32BE(20)
  const f = part.visual.textureFrame, crop = f?.crop || { left: 0, top: 0, width: 1, height: 1 }
  const w = imageWidth / (f?.columns || 1), h = imageHeight / (f?.rows || 1)
  const e = matrix.elements
  commands.push({ z: e[14], layer: part.layer,
    svg: `<g opacity="${opacity}" transform="matrix(${e[0]} ${-e[1]} ${-e[4]} ${e[5]} ${e[12]} ${-e[13]})"><svg x="${-part.width * part.pivotX}" y="${-part.height * part.pivotY}" width="${part.width}" height="${part.height}" viewBox="${((f?.column || 0) + crop.left) * w} ${((f?.row || 0) + crop.top) * h} ${w * crop.width} ${h * crop.height}" preserveAspectRatio="none"><image width="${imageWidth}" height="${imageHeight}" href="data:image/png;base64,${bytes.toString('base64')}"/></svg></g>` })
}
const polygons = commands.sort((a, b) => a.z - b.z || a.layer - b.layer).map((c) => c.svg)
writeFileSync(destination, `<svg xmlns="http://www.w3.org/2000/svg" width="540" height="540" viewBox="-230 -230 460 460"><rect x="-230" y="-230" width="460" height="460" fill="#1b242d"/>${polygons.join('')}</svg>`)
console.log(destination)
