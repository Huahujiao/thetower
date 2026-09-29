import { writeFileSync } from 'node:fs'
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
const polygons = faces.map((face) => `<polygon points="${face.points.map((p) => `${p.x},${p.y}`).join(' ')}" fill="${face.fill}" stroke="${face.fill}" stroke-width=".3" opacity="${face.opacity}"/>`)
writeFileSync(destination, `<svg xmlns="http://www.w3.org/2000/svg" width="540" height="540" viewBox="-230 -230 460 460"><rect x="-230" y="-230" width="460" height="460" fill="#1b242d"/>${polygons.join('')}</svg>`)
console.log(destination)
