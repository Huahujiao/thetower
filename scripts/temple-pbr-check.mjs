import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js'
import { createServer } from 'vite'
import * as THREE from 'three'
const server = await createServer({server:{middlewareMode:true},appType:'custom'})
const previousDocument = globalThis.document
const ctx = new Proxy({}, {get:()=>()=>{}})
globalThis.document = {createElement:tag=>tag==='img'?{}:{width:512,height:512,getContext:()=>ctx}}
try {
  const { BoardTextures } = await server.ssrLoadModule('/src/render/board-textures.js')
  const { setSurfaceColor } = await server.ssrLoadModule('/src/render/surface-color.js')
  const { createCardFaceMaterial, CARD_BACK_NORMAL_SCALE } = await server.ssrLoadModule('/src/render/card-body.js')
  const { createTempleGroundMaterial, addTempleLighting, applyTempleGroundEnvironment, TEMPLE_GROUND_ENV_FACTOR } = await server.ssrLoadModule('/src/render/temple-lighting.js')
  const { loadTempleIBL, TEMPLE_IBL } = await server.ssrLoadModule('/src/render/temple-ibl.js')
  const { registerTempleStoneSurface } = await server.ssrLoadModule('/src/render/temple-stone-materials.js')
  const { TempleEnvironment } = await server.ssrLoadModule('/src/render/temple-environment.js')
  const board = new BoardTextures()
  for (const kind of ['neutral','scorch','wither','drown','blocked']) {
    const texture = board.back(kind,kind==='blocked'), maps = board.surfaceData(texture)
    const material = createCardFaceMaterial(texture,maps.normal,{},maps.surface)
    assert(material.isMeshStandardMaterial)
    const artColor=material.color.clone()
    setSurfaceColor(material,0xffffff)
    assert(material.color.equals(artColor),'Refreshing reachability must preserve the dark card finish')
    assert.equal(material.roughnessMap,maps.surface);assert.equal(material.metalnessMap,maps.surface)
    assert.equal(material.normalMap,maps.normal);assert.equal(material.normalScale.x,CARD_BACK_NORMAL_SCALE)
    assert(material.emissiveIntensity<.05,'IBL must dominate the card lighting')
    material.dispose()
  }
  for (const entry of board.floors) {
    const maps = board.surfaceData(entry.texture), material = createTempleGroundMaterial(entry.texture,{},maps)
    assert(material.isMeshPhysicalMaterial,'Ground retains dielectric specular reflection')
    assert.equal(material.clearcoat,0,'Do not reintroduce the full-surface coating that washed out the stone')
    assert.equal(material.normalMap,maps.normal);assert.equal(material.roughnessMap,maps.surface)
    const floorColor=material.color.clone();setSurfaceColor(material,0xffffff)
    assert(material.color.equals(floorColor),'Revealing a tile must not reset the stone albedo to white')
    assert.equal(material.metalness,0,'Stone must remain dielectric')
    material.dispose()
  }
  // Procedural wall units remain independent meshes with shared surface data.
  const environment = Object.create(TempleEnvironment.prototype)
  const stone = new THREE.Texture(),normal = new THREE.Texture(),surface = new THREE.Texture()
  environment.stone=stone;registerTempleStoneSurface(stone,normal,surface)
  const units = [true,false].map(horizontal=>environment.wall({horizontal,length:1.14,thickness:.14,height:.62}))
  assert.notEqual(units[0],units[1])
  units.forEach(group=>group.traverse(mesh=>{if(mesh.isMesh){
    assert.equal(mesh.material.normalMap,normal);assert.equal(mesh.material.roughnessMap,surface)
    assert.equal(mesh.material.metalness,0);assert(mesh.castShadow&&mesh.receiveShadow)
  }}))
  const scene = new THREE.Scene(), background = new THREE.Color(0x223333)
  scene.background=background
  const skyBytes=await readFile(new URL('../src/assets/environment/kloofendal-overcast-puresky-128.hdr',import.meta.url))
  const compact=new HDRLoader().parse(skyBytes.buffer.slice(skyBytes.byteOffset,skyBytes.byteOffset+skyBytes.byteLength))
  assert.equal(compact.width,128);assert.equal(compact.height,64);assert(skyBytes.length<30000)
  const rig=addTempleLighting(scene), hdr=new THREE.DataTexture(compact.data,compact.width,compact.height,THREE.RGBAFormat,compact.type), filtered=new THREE.Texture()
  const floorMaterial=createTempleGroundMaterial(board.floor(),{},board.surfaceData(board.floor()))
  const floorMesh=new THREE.Mesh(new THREE.PlaneGeometry(1,1),floorMaterial);scene.add(floorMesh)
  let hdrDisposals=0,targetDisposals=0,pmremDisposals=0,conversions=0
  hdr.addEventListener('dispose',()=>hdrDisposals++)
  const ibl=loadTempleIBL({},scene,rig,{
    loader:{async loadAsync(url){assert.equal(url,TEMPLE_IBL.localUrl);return hdr}},
    createPMREM:()=>({fromEquirectangular(texture){conversions++;assert.equal(texture,hdr);assert.equal(texture.image.width,128);return {texture:filtered,dispose(){targetDisposals++}}},dispose(){pmremDisposals++}}),
  })
  assert(await ibl.ready)
  assert.equal(scene.environment,filtered);assert.equal(scene.background,background)
  assert.equal(scene.environmentRotation.y,TEMPLE_IBL.rotationY)
  assert.equal(floorMaterial.envMap,filtered,'Floors created before HDR finishes loading must bind the shared PMREM')
  assert.equal(floorMaterial.envMapIntensity,TEMPLE_IBL.intensity*TEMPLE_GROUND_ENV_FACTOR)
  const laterFloor=createTempleGroundMaterial(board.floor(),{},board.surfaceData(board.floor()))
  applyTempleGroundEnvironment(laterFloor,scene)
  const laterMesh=new THREE.Mesh(new THREE.PlaneGeometry(1,1),laterFloor);scene.add(laterMesh)
  assert.equal(laterFloor.envMap,filtered,'Floors created after room rebuild use the same shared environment')
  assert.equal(laterFloor.envMapRotation.y,TEMPLE_IBL.rotationY)
  assert.equal(rig.children.filter(light=>light.userData.iblFill&&light.intensity>0).length,0)
  assert(rig.getObjectByName('temple-key-light').castShadow)
  const room=new THREE.Group();scene.add(room);room.clear()
  assert.equal(scene.environment,filtered,'Rebuilding procedural rooms retains IBL')
  assert.equal(conversions,1);assert.equal(hdrDisposals,1);assert.equal(pmremDisposals,1)
  ibl.dispose();ibl.dispose();assert.equal(targetDisposals,1);assert.equal(scene.environment,null)
  assert.equal(floorMaterial.envMap,null);assert.equal(laterFloor.envMap,null)
  assert(rig.children.some(light=>light.userData.iblFill&&light.intensity>0))
  // Disposal during loading must never create GPU resources or reattach the map.
  let finish
  const lateHDR=new THREE.Texture();let lateDisposals=0
  lateHDR.addEventListener('dispose',()=>lateDisposals++)
  const pending=loadTempleIBL({},scene,rig,{loader:{loadAsync:()=>new Promise(resolve=>{finish=resolve})},createPMREM:()=>{throw new Error('Must not create after dispose')}})
  pending.dispose();finish(lateHDR);assert.equal(await pending.ready,false)
  assert.equal(lateDisposals,1);assert.equal(scene.environment,null)
  let attempts=0
  const warn=console.warn;console.warn=()=>{}
  try {
    const failed=loadTempleIBL({},scene,rig,{loader:{async loadAsync(){attempts++;throw new Error('offline')}}})
    assert.equal(await failed.ready,false);assert.equal(attempts,1)
    assert(rig.children.some(light=>light.userData.iblFill&&light.intensity>0))
    failed.dispose()
  } finally { console.warn=warn }
  board.dispose()
  console.log('Temple PBR passed: five card backs, four floors, per-cell stone walls, IBL replacement/fallback, room rebuilds and async GPU-resource lifetime.')
} finally { globalThis.document=previousDocument;await server.close() }
