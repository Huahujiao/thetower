import { createEnemyShadowProjects, ENEMY_ART, installEnemyShadowProjects } from '../animation/shadow-enemies.js'
import { evaluateShadowProject, loadShadowRoster } from '../animation/shadow-rig.js'
import { projectShadowFaces } from '../animation/shadow-projection.js'

const images = new Map()
let projects = null
let assetReady = null

// Align enlarged silhouettes in the 160px card texture without reducing
// their requested 1.2x display scale.
const TILE_OFFSETS = {
  'rootrot-bud': [0, 4],
  'tide-shadow-cub': [0, -18],
  'rot-walker': [0, -22],
  'moss-colossus': [0, 0],
  wisp: [0, -17],
  'thorn-shell-flower': [0, 20],
  'redwheel-fire-crow': [5, 0],
  'drown-shadow-hunter': [-3, -6],
  'cinder-curse-lamp-swarm': [-4, -4],
  'tidal-spore-sac': [0, 35],
  'revenant-guard': [0, -2.5],
  'cracked-hunter': [0, -6],
  'leech-larva': [0, -12],
}

function imageFor(url) {
  if (!url) return null
  if (!images.has(url)) {
    const image = new Image()
    images.set(url, image)
    image.onload = () => assetReady?.()
    image.src = url
  }
  const image = images.get(url)
  return image.complete && image.naturalWidth ? image : null
}

export function prepareEnemyPuppets(onReady) {
  assetReady = onReady
  projects = new Map(createEnemyShadowProjects().map((project) => [project.enemyId, project]))
  const roster = loadShadowRoster()
  installEnemyShadowProjects(roster)
  for (const { project } of roster.characters) {
    if (project.enemyId && projects.has(project.enemyId)) projects.set(project.enemyId, project)
  }
}

export function enemyPuppetProject(enemyId) {
  return projects?.get(enemyId) || null
}

function drawShape(context, part) {
  const left = -part.width * part.pivotX
  const top = -part.height * part.pivotY
  context.beginPath()
  if (part.shape === 'ellipse' || part.shape === 'circle') {
    context.ellipse(left + part.width / 2, top + part.height / 2, part.width / 2, part.height / 2, 0, 0, Math.PI * 2)
  } else if (part.shape === 'triangle') {
    context.moveTo(left + part.width / 2, top)
    context.lineTo(left + part.width, top + part.height)
    context.lineTo(left, top + part.height)
    context.closePath()
  } else if (part.shape === 'diamond') {
    context.moveTo(left + part.width / 2, top)
    context.lineTo(left + part.width, top + part.height / 2)
    context.lineTo(left + part.width / 2, top + part.height)
    context.lineTo(left, top + part.height / 2)
    context.closePath()
  } else {
    context.roundRect(left, top, part.width, part.height, part.shape === 'capsule' ? Math.min(part.width, part.height) / 2 : 0)
  }
  context.fillStyle = part.fill
  context.fill()
  context.strokeStyle = part.stroke
  context.lineWidth = 2
  context.stroke()
}

function drawPart(context, entry) {
  const { part, matrix, opacity } = entry
  const elements = matrix.elements
  context.save()
  context.transform(elements[0], -elements[1], -elements[4], elements[5], elements[12], -elements[13])
  context.globalAlpha *= opacity
  const image = part.visual.type === 'texture' ? imageFor(part.visual.texture) : null
  if (image) {
    const frame = part.visual.textureFrame
    const cellWidth = image.naturalWidth / (frame?.columns || 1)
    const cellHeight = image.naturalHeight / (frame?.rows || 1)
    const crop = frame?.crop || { left: 0, top: 0, width: 1, height: 1 }
    context.drawImage(image, ((frame?.column || 0) + crop.left) * cellWidth, ((frame?.row || 0) + crop.top) * cellHeight,
      cellWidth * crop.width, cellHeight * crop.height,
      -part.width * part.pivotX, -part.height * part.pivotY, part.width, part.height)
  } else if (part.visual.type !== 'texture') {
    drawShape(context, part)
  }
  context.restore()
  return Boolean(image) || part.visual.type !== 'texture'
}

export function drawEnemyPuppet(context, enemyId, action = 'idle', time = 0) {
  const project = enemyPuppetProject(enemyId)
  if (!project) return false
  const evaluation = evaluateShadowProject(project, action, time)
  const family = ENEMY_ART[enemyId]?.family
  const scale = family === 'humanoid' || family === 'winged' || family === 'quadruped' ? .34
    : family === 'arthropod' ? .35 : .4
  context.save()
  const [offsetX, offsetY] = TILE_OFFSETS[enemyId] || [0, 0]
  context.translate(80 + offsetX, 78 + offsetY)
  context.scale(scale * 1.2, scale * 1.2)
  let drawn = false
  const commands = [
    ...projectShadowFaces(evaluation),
    ...evaluation.parts.filter(({ part }) => part.visual.type === 'texture').map((entry) => ({ entry, z: entry.matrix.elements[14], layer: entry.part.layer })),
  ].sort((a, b) => a.z - b.z || a.layer - b.layer)
  for (const command of commands) {
    if (command.entry) { drawn = drawPart(context, command.entry) || drawn; continue }
    context.save()
    context.globalAlpha *= command.opacity
    context.beginPath()
    command.points.forEach((point, index) => {
      if (!index) context.moveTo(point.x, point.y)
      else context.lineTo(point.x, point.y)
    })
    context.closePath()
    context.fillStyle = command.fill
    context.fill()
    context.restore()
    drawn = true
  }
  context.restore()
  return drawn
}
