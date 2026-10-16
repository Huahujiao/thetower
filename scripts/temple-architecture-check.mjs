import assert from 'node:assert/strict'
import { createServer } from 'vite'
import * as THREE from 'three'
const server = await createServer({server:{middlewareMode:true},appType:'custom'})
const previousDocument=globalThis.document
const context=new Proxy({}, {get:(_target,key)=>key==='createRadialGradient'||key==='createLinearGradient'?()=>({addColorStop(){}}):()=>{}})
globalThis.document={createElement:()=>({width:0,height:0,getContext:()=>context})}
try {
  const { dressedStoneBox, templeStoneMaterial, registerTempleStoneSurface, foundationStoneMaterial }=await server.ssrLoadModule('/src/render/temple-stone-materials.js')
  const { createStoneDoorFrame, createTempleLockedGate }=await server.ssrLoadModule('/src/render/wall-kit.js')
  const { createTempleArchitectureReview }=await server.ssrLoadModule('/src/render/temple-architecture-review.js')
  const { GameScene }=await server.ssrLoadModule('/src/render/scene.js')
  for(const size of [[.53,.12,.53],[3,.1,.2],[.095,.62,.23],[10,10,9]]){
    const geometry=dressedStoneBox(size)
    geometry.computeBoundingBox()
    const dimensions=geometry.boundingBox.getSize(new THREE.Vector3()).toArray()
    dimensions.forEach((value,index)=>assert(Math.abs(value-size[index])<1e-5,'Bevel preserves assembled dimensions'))
    for(const attribute of ['position','normal','uv','color'])assert([...geometry.attributes[attribute].array].every(Number.isFinite),attribute)
    const diagonalNormals=Array.from({length:geometry.attributes.normal.count},(_,i)=>Math.abs(geometry.attributes.normal.getY(i))).filter(value=>value>.01&&value<.99)
    assert(diagonalNormals.length>0,'Bevel must have intermediate smooth normals')
    assert(geometry.attributes.position.count/3<=300,'Rounded stone must stay within the per-block triangle budget')
    geometry.dispose()
  }
  const stone=new THREE.Texture(),normal=new THREE.Texture(),surface=new THREE.Texture(),wood=new THREE.Texture()
  for(const texture of [stone,normal,surface,wood])texture.userData.boardShared=true
  registerTempleStoneSurface(stone,normal,surface)
  const material=templeStoneMaterial(stone)
  assert.equal(material.normalMap,normal);assert.equal(material.aoMap,surface);assert.equal(material.roughnessMap,surface)
  let disposed=0;normal.addEventListener('dispose',()=>disposed++);material.dispose();assert.equal(disposed,0,'Material cannot own shared maps')
  const foundation=foundationStoneMaterial(stone)
  assert(!foundation.transparent&&foundation.depthWrite)
  const shader={uniforms:{},vertexShader:'#include <begin_vertex>',fragmentShader:'#include <color_fragment>'}
  foundation.onBeforeCompile(shader)
  assert(shader.vertexShader.includes('vTempleHeight ='))
  assert(shader.fragmentShader.includes('diffuseColor.rgb *='))
  for(const variant of ['arch','broken','pillars']){
    const frame=createStoneDoorFrame({horizontal:true,width:.98,depth:.196,height:.8,variant,texture:stone})
    const ray=new THREE.Raycaster(new THREE.Vector3(0,.4,2),new THREE.Vector3(0,0,-1))
    frame.updateMatrixWorld(true)
    assert.equal(ray.intersectObject(frame,true).length,0,'Open portal centre must remain empty: '+variant)
    const gate=createTempleLockedGate({horizontal:true,width:.98,depth:.196,height:.8,variant,texture:wood})
    gate.updateMatrixWorld(true)
    for(const sign of [-1,1]){
      const gateRay=new THREE.Raycaster(new THREE.Vector3(.13,.35,sign*2),new THREE.Vector3(0,0,-sign))
      assert(gateRay.intersectObject(gate,true).length>0,'Locked gate must cover both sides')
    }
    const rings=gate.children.filter(mesh=>mesh.geometry.type==='TorusGeometry')
    assert.equal(rings.length,4,'Gate knockers must exist on both sides')
  }
  for(const scenic of [true,false])for(const side of ['top','bottom','left','right']){
    const room={id:'architecture-room',width:6,height:5},door={id:'review-door',side,offset:2}
    let locked=true
    const scene=Object.create(GameScene.prototype)
    Object.assign(scene,{run:{dungeon:{door:()=>door},isDoorLocked:()=>locked,isExitDoor:()=>false},environment:scenic?{stone,gateWood:wood}:null,structureGroup:new THREE.Group(),doorMeshes:[]})
    scene._addDoorMesh(room,door)
    const mesh=scene.doorMeshes[0]
    assert(mesh.userData.lockedFrame.visible)
    assert.equal(mesh.userData.stoneFrame.visible,scenic)
    if(scenic){assert.equal(mesh.material.opacity,0);assert.equal(mesh.material.depthWrite,false)}
    locked=false;scene._setDoorAppearance(mesh)
    assert(!mesh.userData.lockedFrame.visible&&mesh.userData.stoneFrame.visible)
    assert.equal(mesh.material.opacity,0)
    assert(!mesh.userData.lockIndicator.visible)
    locked=true;scene._setDoorAppearance(mesh)
    assert(mesh.userData.lockedFrame.visible&&mesh.userData.lockIndicator.visible)
    const point=mesh.position.clone()
    const outward=side==='left'?new THREE.Vector3(-1,0,0):side==='right'?new THREE.Vector3(1,0,0):side==='top'?new THREE.Vector3(0,0,-1):new THREE.Vector3(0,0,1)
    mesh.updateMatrixWorld(true)
    const ray=new THREE.Raycaster(point.clone().addScaledVector(outward,2),outward.clone().negate())
    assert(ray.intersectObject(mesh,false).length>0,'Invisible door hit volume must remain clickable')
  }
  const group=createTempleArchitectureReview(stone,stone,stone,wood)
  group.updateMatrixWorld(true)
  const foundationMesh=group.getObjectByName('platform-foundation-wall')
  const plantingWall=group.getObjectByName('planting-outer-wall-front')
  const foundationBounds=new THREE.Box3().setFromObject(foundationMesh)
  const plantingBounds=new THREE.Box3().setFromObject(plantingWall)
  assert(Math.abs(foundationBounds.max.y-plantingBounds.min.y)<1e-6,'Deep side wall must butt against the upper wall without coplanar overlap')
  const upperRay=new THREE.Raycaster(new THREE.Vector3((plantingBounds.min.x+plantingBounds.max.x)/2,-.55,foundationBounds.max.z+2),new THREE.Vector3(0,0,-1))
  const surfaceHits=mesh=>{const hits=[];THREE.Mesh.prototype.raycast.call(mesh,upperRay,hits);return hits}
  assert(surfaceHits(plantingWall).length>0,'Upper wall still covers the first row')
  assert.equal(surfaceHits(foundationMesh).length,0,'The first row cannot have a duplicate deep wall behind it')
  assert(Math.abs(foundationBounds.min.y-(-.43-2.32*4.5))<1e-5,'Keep the existing lower wall extent')
  let triangles=0
  group.traverse(mesh=>{if(!mesh.isMesh)return;triangles+=(mesh.geometry.index?.count||mesh.geometry.attributes.position.count)/3;for(const [attribute,data] of Object.entries(mesh.geometry.attributes))assert([...data.array].every(Number.isFinite),mesh.name+': '+attribute)})
  assert(triangles<110000,'Full four-door review fixture geometry budget')
  console.log('Temple architecture passed: rounded bounds/UVs, material ownership, solid foundation, three open portals, two-sided gates, all four door directions, lock/unlock visibility and picking; '+triangles+' triangles in review fixture.')
}finally{globalThis.document=previousDocument;await server.close()}
