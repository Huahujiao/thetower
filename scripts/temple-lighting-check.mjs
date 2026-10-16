import assert from 'node:assert/strict'
import { createServer } from 'vite'
import * as THREE from 'three'
const server=await createServer({server:{middlewareMode:true},appType:'custom'})
const previousDocument=globalThis.document,previousImage=globalThis.Image
const ctx=new Proxy({}, {get:(_target,key)=>key==='createLinearGradient'||key==='createRadialGradient'?()=>({addColorStop(){}}):()=>{}})
globalThis.document={createElement:tag=>tag==='img'?{}:{width:512,height:512,getContext:()=>ctx}}
globalThis.Image=class{complete=false}
try{
    const {GameScene}=await server.ssrLoadModule('/src/render/scene.js')
    const {BoardTextures}=await server.ssrLoadModule('/src/render/board-textures.js')
  const {fixture}=await server.ssrLoadModule('/scripts/item-test-helpers.mjs')
  const {prepareEnemyPuppets,createEnemyFigure}=await server.ssrLoadModule('/src/render/enemy-puppet.js')
    const run=fixture(),room=run.currentRoom
  run.sceneView={environment:'mountain-temple',cameraAzimuth:0}
  const scene=Object.create(GameScene.prototype)
  Object.assign(scene,{run,scene:new THREE.Scene(),environment:{},boardTextures:new BoardTextures(),contactShadowTexture:new THREE.Texture(),roomGroup:new THREE.Group(),tileMeshes:[],tileMeshByKey:new Map(),framedRoomId:room.id,flipAnimations:[],animationQueue:[],camera:new THREE.PerspectiveCamera(),cameraElevation:.7,baseCameraDistance:12,zoom:1,
    _attachGroundSprite(){},_setEnemyStatusOverlay(){},_setContactShadow(){},_attachEnemyFigure(){},_drainAnimationQueue(){},_emitMoveCompleteIfIdle(){},_updateCameraFacingTokens(){},
  })
  scene.scene.add(scene.roomGroup)
    scene._addLights()
  const rig=scene.templeLighting,key=rig.getObjectByName('temple-key-light')
  const origin=()=>key.getWorldPosition(new THREE.Vector3()).sub(key.target.getWorldPosition(new THREE.Vector3()))
  assert(key.position.x<0&&key.position.z<0&&key.position.y>0,'Main sun must be beyond the tree on the left')
  assert(key.castShadow)
  const ambient=rig.getObjectByName('temple-ambient-light')
  assert(ambient?.isAmbientLight&&ambient.intensity>0,'An omnidirectional ambient light must preserve back-facing surface detail')
  assert(!ambient.castShadow,'Global fill must not create another shadow pass')
  assert.equal(rig.children.filter(light=>light.castShadow).length,1,'Only the main light renders shadows')
  scene.scene.updateMatrixWorld(true);const direction=origin()
  for(const [x,z] of [[-2,1],[3,-2],[0,0]]){
    scene.roomGroup.position.set(x,0,z);scene._updateCamera();scene.scene.updateMatrixWorld(true)
    assert(origin().distanceTo(direction)<1e-9,'Panning must not rotate the light')
    assert(rig.position.distanceTo(scene.roomGroup.position)<1e-9,'Shadow camera follows the whole room')
  }
  assert.equal(rig.parent,scene.scene,'Full room clears must not remove the lights')
    for(const entity of [...room.entities.values()])room.removeEntity(entity.id)
  run.player.pos={c:0,r:0}
  const position={c:2,r:3};room.tile(position).revealed=false
  scene._addTile(room,position)
  const face=scene.tileMeshByKey.get('2:3')
  assert(face.material.isMeshStandardMaterial&&face.material.normalMap)
  const cardColor=face.material.color.clone()
  const normal=face.material.normalMap
  const floorY=face.userData.floorBacking.position.y
  const restingBottom=face.userData.body.position.y-.18/2
  assert(Math.abs(restingBottom-(floorY+.002))<1e-8,'A hidden card rests on the common floor instead of lowering it')
  room.tile(position).revealed=true;scene._refreshTile(room,position)
  assert(face.material.isMeshStandardMaterial&&face.material.normalMap===scene.boardTextures.surfaceData(face.material.map).normal,'Revealed ground must use its own stone normal')
  assert(face.receiveShadow&&face.userData.floorBacking.receiveShadow)
  assert(Math.abs(face.position.y-floorY-.002)<1e-8,'Revealed floor and hidden-card backing have only raster clearance')
  assert.equal(face.userData.floorBacking.position.y,floorY,'Reveal must not raise the floor')
  room.tile(position).revealed=false;scene._refreshTile(room,position)
  assert.equal(face.material.normalMap,normal)
  assert(face.material.color.equals(cardColor),'Hide/reveal transitions preserve the card surface colour')
  const snapshot=scene._snapshotFlipBack({roomId:room.id,position})
  room.tile(position).revealed=true
  assert(scene._startFlip({roomId:room.id,position},snapshot))
  const flip=scene.flipAnimations[0]
  assert(Math.abs(flip.startY-(floorY+.002+.18/2))<1e-8,'Flip starts where the resting card was')
  scene._updateFlipAnimations(.1)
  assert.equal(face.userData.floorBacking.position.y,floorY,'Ground remains fixed during a flip')
  assert(flip.front.material.isMeshStandardMaterial&&flip.front.receiveShadow,'Flip ground must receive the same sun')
  assert.equal(flip.back.material.normalMap,normal)
  scene._updateFlipAnimations(1)
  assert(face.material.isMeshStandardMaterial&&face.material.normalMap!==normal)
    const from={c:0,r:0};room.tile(from).revealed=true
  scene._addTile(room,from)
  const playerFace=scene.tileMeshByKey.get('0:0')
  assert(playerFace.material.isMeshBasicMaterial,'Standing characters stay unlit')
  assert(playerFace.userData.groundFace.material.isMeshStandardMaterial&&playerFace.userData.groundFace.receiveShadow)
  assert(Math.abs(playerFace.userData.groundFace.position.y-floorY-.002)<1e-8,'Actor ground shares the same floor level')
  assert(scene._startMove({roomId:room.id,from,path:[{c:1,r:0}]}))
  assert(playerFace.material.isMeshStandardMaterial&&playerFace.material.depthTest,'Moving away must restore a lit floor')
  const marker=scene.movementAnimation.group.children.find(child=>child.isMesh)
  assert(marker.material.isMeshBasicMaterial&&!marker.castShadow)
  assert(scene.movementAnimation.group.userData.contactShadow,'Player retains its fake contact shadow')
    prepareEnemyPuppets(()=>{})
  const enemy=createEnemyFigure('gnawer')
  enemy.traverse(mesh=>{if(mesh.isMesh)assert(mesh.material.isMeshBasicMaterial&&!mesh.castShadow,'Enemies keep the unlit/fake-shadow style')})
  scene._clearMovementAnimation()
  scene.environment=null
  const fallback=scene._makeCardFaceMaterial(scene.boardTextures.floor(position))
  assert(fallback.isMeshBasicMaterial,'Other environments retain their presentation')
  fallback.dispose();scene.boardTextures.dispose()
  console.log('Temple lighting passed: tree-side sun, one shadow light, pan stability, lit floor/backing, flip and move transitions, unlit actors with fake shadows, legacy environment isolation.')
}finally{globalThis.document=previousDocument;globalThis.Image=previousImage;await server.close()}
