import * as THREE from 'three'
import { createCardFaceMaterial } from './card-body.js'
import { createTempleGroundMaterial } from './temple-lighting.js'
import { TempleEnvironment, TEMPLE_BOUNDARY_INSET } from './temple-environment.js'
import { TemplePlatformDepth } from './temple-platform-depth.js'
import { templeBoundaryLayout, templeDoorPlacement } from './temple-boundary-layout.js'
import { createTempleLockedGate, createStoneDoorFrame } from './wall-kit.js'

// A presentation-only inspection fixture using production geometry/materials.
export function createTempleArchitectureReview(stone, masonry, floor, wood, boardTextures = null) {
  const group = new THREE.Group()
  const environment = Object.create(TempleEnvironment.prototype)
  environment.stone = stone
  environment.soilStone = floor
  const room = { width: 6, height: 5 }, tileSize = 1.14
  const doors = [
    { id: 'review-arch', side: 'top', offset: 2, variant: 'arch' },
    { id: 'review-broken', side: 'right', offset: 2, variant: 'broken' },
    { id: 'review-pillars', side: 'bottom', offset: 2, variant: 'pillars' },
    { id: 'review-locked', side: 'left', offset: 2, variant: 'arch', locked: true },
  ]
  const layout = templeBoundaryLayout(room, doors, tileSize, TEMPLE_BOUNDARY_INSET)
  for (const point of layout.corners) {
    const pillar = environment.pillar({ height: 1.18 })
    pillar.position.set(point.x, 0, point.z)
    group.add(pillar)
  }
  for (const side of layout.sides) {
    for (const span of side.rails) {
      const rail = environment.wall({ horizontal: side.horizontal, length: span.length, thickness: .14, height: .62 })
      rail.position.set(span.x, 0, span.z); group.add(rail)
    }
    for (const slot of side.posts) {
      const post = environment.railingPost(slot.kind, .62)
      post.position.set(slot.x, 0, slot.z)
      if (!side.horizontal) post.rotation.y = Math.PI / 2
      group.add(post)
    }
  }
  for (const door of doors) {
    const placement = templeDoorPlacement(room, door, tileSize, TEMPLE_BOUNDARY_INSET)
    const stoneFrame = createStoneDoorFrame({ horizontal: door.side === 'top' || door.side === 'bottom', width: placement.openingWidth, depth: .196, height: .8, variant: door.variant, texture: stone })
    stoneFrame.position.set(placement.x, 0, placement.z)
    group.add(stoneFrame)
    if (door.locked) {
      const gate = createTempleLockedGate({horizontal:false,width:placement.openingWidth,depth:.196,height:.8,variant:door.variant,texture:wood})
      gate.position.copy(stoneFrame.position);group.add(gate)
    }
  }
  const planting = environment.plantingBelt(group, room, tileSize, doors.map(door => ({...door, ...templeDoorPlacement(room, door, tileSize, TEMPLE_BOUNDARY_INSET), width: .98})))
  new TemplePlatformDepth(group, planting.belt.userData.planting, stone, masonry)
  const deck = new THREE.Mesh(new THREE.BoxGeometry(room.width * tileSize, .07, room.height * tileSize),new THREE.MeshStandardMaterial({color:0x828a80, map:floor,roughness:1}))
  deck.position.y = -.015;deck.receiveShadow = true;group.add(deck)
  for(let r=0;r<room.height;r++)for(let c=0;c<room.width;c++){
    const tile = new THREE.Mesh(new THREE.BoxGeometry(1.11,.035,1.11),new THREE.MeshStandardMaterial({color:(c+r)%3===0?0x53605b:0x6b7369,roughness:.96,map:floor}))
    if (boardTextures) {
      tile.material.dispose()
      const kind = ['neutral','scorch','wither','drown','blocked'][r]
      const texture = c < 3 ? boardTextures.back(kind, kind === 'blocked') : boardTextures.floor({c,r})
      const maps = boardTextures.surfaceData(texture)
      tile.material = c < 3 ? createCardFaceMaterial(texture,maps.normal,{},maps.surface) : createTempleGroundMaterial(texture,{},maps)
    }
    tile.position.set((c-(room.width-1)/2)*tileSize,.038,(r-(room.height-1)/2)*tileSize);tile.receiveShadow=true;group.add(tile)
  }
  group.userData.reviewDoors = doors
  return group
}
