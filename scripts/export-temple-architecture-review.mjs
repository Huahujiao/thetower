import { createServer } from 'vite'
import * as THREE from 'three'
import { writeFile, mkdir } from 'node:fs/promises'
import { gzipSync } from 'node:zlib'
const server = await createServer({server:{middlewareMode:true},appType:'custom'})
try {
  const { TEMPLE_LIGHTING } = await server.ssrLoadModule('/src/render/temple-lighting.js')
  const { registerTempleStoneSurface } = await server.ssrLoadModule('/src/render/temple-stone-materials.js')
  const { createTempleArchitectureReview } = await server.ssrLoadModule('/src/render/temple-architecture-review.js')
  const tex = (name, linear=false) => {
    const texture = new THREE.Texture({src:'src/assets/'+name})
    texture.wrapS=texture.wrapT=THREE.RepeatWrapping
    texture.colorSpace=linear?THREE.NoColorSpace:THREE.SRGBColorSpace
    return texture
  }
  const stone=tex('environment/temple-dressed-stone-v1.jpg'), masonry=tex('environment/temple-foundation-masonry-v1.jpg'),floor=tex('board-floor-plain-v1.jpg')
  for (const [albedo,name] of [[stone,'temple-dressed-stone-v1'],[masonry,'temple-foundation-masonry-v1']])registerTempleStoneSurface(albedo,tex('environment/'+name+'-normal.png',true),tex('environment/'+name+'-surface.png',true))
  const group = createTempleArchitectureReview(stone,masonry,floor,tex('environment/temple-gate-lacquer-v1.jpg'))
  group.updateMatrixWorld(true)
  const meshes=[], materials=[], materialIds=new Map()
  group.traverse(mesh=>{
    if(!mesh.isMesh||!mesh.visible||mesh.isInstancedMesh)return
    const m=mesh.material
    if(!materialIds.has(m)){
      materialIds.set(m,materials.length)
      materials.push({color:m.color.toArray(),map:m.map?.image?.src||null,normal:m.normalMap?.image?.src||null,surface:m.roughnessMap?.image?.src||null,roughness:m.roughness??1,normalScale:m.normalScale?.x||0,ao:m.aoMapIntensity??0,depth:m.customProgramCacheKey?.().includes('foundation-solid-depth')})
    }
    const g=mesh.geometry.index?mesh.geometry.toNonIndexed():mesh.geometry
    const points=[],normals=[],normalMatrix=new THREE.Matrix3().getNormalMatrix(mesh.matrixWorld)
    for(let i=0;i<g.attributes.position.count;i++){
      points.push(...new THREE.Vector3().fromBufferAttribute(g.attributes.position,i).applyMatrix4(mesh.matrixWorld).toArray())
      normals.push(...new THREE.Vector3().fromBufferAttribute(g.attributes.normal,i).applyNormalMatrix(normalMatrix).toArray())
    }
    meshes.push({name:mesh.name,material:materialIds.get(m),positions:points,normals,uv:Array.from(g.attributes.uv?.array||new Float32Array(points.length/3*2)),colors:g.attributes.color?Array.from(g.attributes.color.array):null,shadow:mesh.castShadow})
  })
  await mkdir('tmp/architecture-review',{recursive:true})
  const target=process.argv[2]||'tmp/architecture-review/scene.json.gz'
  await writeFile(target,gzipSync(JSON.stringify({meshes,materials,lighting:TEMPLE_LIGHTING})))
  console.log(JSON.stringify({target,meshes:meshes.length,triangles:meshes.reduce((s,m)=>s+m.positions.length/9,0)}))
}finally{await server.close()}
