import { createEnemyShadowProjects, ENEMY_ART, installEnemyShadowProjects } from '../animation/shadow-enemies.js'
import { evaluateShadowProject, loadShadowRoster } from '../animation/shadow-rig.js'
import { projectShadowFaces } from '../animation/shadow-projection.js'
import * as THREE from 'three'
import { shadowPartGeometry } from '../animation/shadow-geometry.js'
import { applyTextureBacking } from './texture-backing.js'
import { shadowPartFloor } from '../animation/shadow-grounding.js'

const images = new Map()
let projects = null
let assetReady = null
let silhouettes = new WeakMap()
const GNAWER_DISPLAY_SCALE = .34 * 1.2
// Transparent animation margin; the scene enlarges the plane by the same
// factor, keeping the visible idle figure at its normalized world size.
export const ENEMY_PUPPET_PADDING = 64

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
  projects = new Map(createEnemyShadowProjects({ includeBoss: true }).map((project) => [project.enemyId, project]))
  const roster = loadShadowRoster()
  installEnemyShadowProjects(roster)
  for (const { project } of roster.characters) {
    if (project.enemyId && projects.has(project.enemyId)) projects.set(project.enemyId, project)
  }
  silhouettes = new WeakMap()
  for (const project of projects.values()) for (const part of project.parts) {
    if (part.visual.type === 'texture') imageFor(part.visual.texture)
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

function drawProject(context, project, action = 'idle', time = 0) {
  const evaluation = evaluateShadowProject(project, action, time)
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
  return drawn
}

function silhouette(project) {
  if (silhouettes.has(project)) return silhouettes.get(project)
  // Measure the visible, cropped texture pixels, not transparent PNG margins.
  // Wait for every part so an incomplete load cannot lock in a wrong scale.
  if (project.parts.some(p => p.visual.type === 'texture' && !imageFor(p.visual.texture))) return null
  const probe = document.createElement('canvas')
  probe.width = probe.height = 1536
  const context = probe.getContext('2d', { willReadFrequently: true })
  context.translate(768, 768)
  if (!drawProject(context, project)) return null
  const pixels = context.getImageData(0, 0, probe.width, probe.height).data
  let left = probe.width, right = -1, top = probe.height, bottom = -1
  for (let y = 0; y < probe.height; y++) for (let x = 0; x < probe.width; x++) {
    if (pixels[(y * probe.width + x) * 4 + 3] <= 8) continue
    left = Math.min(left, x); right = Math.max(right, x)
    top = Math.min(top, y); bottom = Math.max(bottom, y)
  }
  if (right < left || bottom < top) return null
  const bounds = { width: right - left + 1, height: bottom - top + 1,
    centerX: (left + right + 1) / 2 - 768, centerY: (top + bottom + 1) / 2 - 768 }
  bounds.diagonal = Math.hypot(bounds.width, bounds.height)
  silhouettes.set(project, bounds)
  return bounds
}

export function enemyPuppetLayout(enemyId) {
  const project = enemyPuppetProject(enemyId), reference = enemyPuppetProject('gnawer')
  if (!project || !reference) return null
  const bounds = silhouette(project), referenceBounds = silhouette(reference)
  if (!bounds || !referenceBounds) return null
  const diagonal = referenceBounds.diagonal * GNAWER_DISPLAY_SCALE
  return { ...bounds, scale: diagonal / bounds.diagonal, displayDiagonal: diagonal }
}

export function drawEnemyPuppet(context, enemyId, action = 'idle', time = 0) {
  const project = enemyPuppetProject(enemyId)
  if (!project) return false
  const layout = enemyPuppetLayout(enemyId)
  // A fixed idle silhouette controls every frame. Animation never changes
  // the normalization factor or stretches a limb independently.
  const family = ENEMY_ART[enemyId]?.family
  const scale = layout?.scale ?? (family === 'arthropod' ? .35 : .34) * 1.2
  context.save()
  context.translate(80 - (layout?.centerX || 0) * scale, 80 - (layout?.centerY || 0) * scale)
  context.scale(scale, scale)
  const drawn = drawProject(context, project, action, time)
  context.restore()
  return drawn
}

const partTextures = new Map()
const skinTextures = new Map()
function skinTexture(url) {
  if (!url) return null
  if (!skinTextures.has(url)) {
    const texture = new THREE.TextureLoader().load(url, () => assetReady?.())
    texture.colorSpace = THREE.SRGBColorSpace
    texture.userData.boardShared = true
    skinTextures.set(url, texture)
  }
  return skinTextures.get(url)
}
function puppetTexture(part) {
  const image = imageFor(part.visual.texture)
  if (!image) return null
  const frame = part.visual.textureFrame || {}
  const key = `${part.visual.texture}|${JSON.stringify(frame)}`
  if (partTextures.has(key)) return partTextures.get(key)
  const cellWidth = image.naturalWidth / (frame.columns || 1), cellHeight = image.naturalHeight / (frame.rows || 1)
  const crop = frame.crop || { left: 0, top: 0, width: 1, height: 1 }
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.ceil(cellWidth * crop.width))
  canvas.height = Math.max(1, Math.ceil(cellHeight * crop.height))
  canvas.getContext('2d').drawImage(image, ((frame.column || 0) + crop.left) * cellWidth, ((frame.row || 0) + crop.top) * cellHeight,
    cellWidth * crop.width, cellHeight * crop.height, 0, 0, canvas.width, canvas.height)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 4
  texture.userData.boardShared = true
  partTextures.set(key, texture)
  return texture
}

// Both textured and geometry-only enemies use the same articulated 3D actor.
export function createEnemyFigure(enemyId, cardSize = 1.14) {
  const project = enemyPuppetProject(enemyId)
  if (!project) return null
  const group = new THREE.Group(), rig = new THREE.Group()
  group.add(rig)
  group.userData.enemyId = enemyId
  group.userData.rig = rig
  group.userData.cardSize = cardSize
  group.userData.meshes = new Map()
  for (const part of project.parts) {
    const textured = part.visual.type === 'texture'
    const geometry = textured && part.shape !== 'hexagon' ? new THREE.PlaneGeometry(part.width, part.height) : shadowPartGeometry(part)
    if (textured && part.shape !== 'hexagon') geometry.translate(part.width * (.5 - part.pivotX), part.height * (part.pivotY - .5), 0)
    if (textured && part.shape === 'hexagon') {
      const uv = geometry.attributes.uv, position = geometry.attributes.position
      for (let i = 0; i < uv.count; i++) uv.setXY(i, position.getX(i) / part.width + part.pivotX, position.getY(i) / part.height + 1 - part.pivotY)
    }
    const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({
      color: textured ? 0xffffff : part.fill, map: textured ? puppetTexture(part) : null,
      side: THREE.DoubleSide, transparent: true, alphaTest: textured ? .04 : 0, depthTest: true, depthWrite: true,
    }))
    if (textured) applyTextureBacking(mesh.material, part.visual.backingColor, skinTexture(part.visual.skinTexture))
    mesh.matrixAutoUpdate = false
    mesh.raycast = () => {}
    rig.add(mesh)
    group.userData.meshes.set(part.id, mesh)
  }
  updateEnemyFigure(group)
  return group
}

export function updateEnemyFigure(group, action = 'idle', time = 0, { opacity = 1, flash = 0 } = {}) {
  const project = enemyPuppetProject(group?.userData.enemyId)
  if (!project) return
  const layout = enemyPuppetLayout(project.enemyId)
  const scale = (layout?.scale ?? GNAWER_DISPLAY_SCALE) * group.userData.cardSize / 160
  const evaluation = evaluateShadowProject(project, action, time)
  const idle = project.grounding?.floating ? evaluateShadowProject(project, 'idle', 0) : null
  const floorY = idle ? Math.min(...idle.parts.map(shadowPartFloor)) : project.grounding?.floorY || 0
  const rig = group.userData.rig
  rig.scale.setScalar(scale)
  rig.position.set(-(layout?.centerX || 0) * scale, -floorY * scale + (idle ? group.userData.cardSize * .14 : 0), 0)
  for (const entry of evaluation.parts) {
    const mesh = group.userData.meshes.get(entry.part.id)
    mesh.matrix.copy(entry.matrix)
    mesh.matrixWorldNeedsUpdate = true
    mesh.material.opacity = entry.opacity * opacity
    if (entry.part.visual.type === 'texture') {
      const texture = puppetTexture(entry.part)
      if (texture !== mesh.material.map) { mesh.material.map = texture; mesh.material.needsUpdate = true }
      mesh.visible = !!texture && entry.opacity > .001
      mesh.material.color.set(0xffffff).lerp(new THREE.Color(0xff9b43), flash)
    } else {
      mesh.visible = entry.opacity > .001
      mesh.material.color.set(entry.part.fill).lerp(new THREE.Color(0xff9b43), flash)
    }
  }
}
