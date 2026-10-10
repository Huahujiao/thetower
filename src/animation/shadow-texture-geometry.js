import { Shape, ShapeGeometry } from 'three'
import { shadowPartShape } from './shadow-geometry.js'

// Shared by the editor stage and the gallery so cropped parts look identical.
export function shadowTextureGeometry(part, texture) {
  const image = texture?.image
  const frame = part.visual.textureFrame
  const crop = frame?.crop || { left: 0, top: 0, width: 1, height: 1 }
  const imageWidth = (image?.naturalWidth || image?.width || part.width) / (frame?.columns || 1) * crop.width
  const imageHeight = (image?.naturalHeight || image?.height || part.height) / (frame?.rows || 1) * crop.height
  const imageRatio = imageWidth / imageHeight
  const boxRatio = part.width / part.height
  const cover = part.visual.textureFit === 'cover'
  const contain = !cover && part.visual.textureFit !== 'stretch'
  const width = contain && imageRatio < boxRatio ? part.height * imageRatio : part.width
  const height = contain && imageRatio > boxRatio ? part.width / imageRatio : part.height
  const left = -part.width * part.pivotX + (part.width - width) / 2
  const top = part.height * part.pivotY - (part.height - height) / 2
  const shape = part.shape === 'hexagon' ? shadowPartShape(part) : new Shape()
  if (part.shape !== 'hexagon') {
    shape.moveTo(left, top)
    shape.lineTo(left + width, top)
    shape.lineTo(left + width, top - height)
    shape.lineTo(left, top - height)
    shape.closePath()
  }
  const geometry = new ShapeGeometry(shape)
  const uv = geometry.attributes.uv
  const positions = geometry.attributes.position
  const cropX = cover && imageRatio > boxRatio ? (1 - boxRatio / imageRatio) / 2 : 0
  const cropY = cover && imageRatio < boxRatio ? (1 - imageRatio / boxRatio) / 2 : 0
  for (let index = 0; index < uv.count; index += 1) {
    const u = (positions.getX(index) - left) / width
    const v = 1 + (positions.getY(index) - top) / height
    const frameU = cropX + u * (1 - 2 * cropX)
    const frameV = cropY + v * (1 - 2 * cropY)
    uv.setXY(index, frame ? (frame.column + crop.left + frameU * crop.width) / frame.columns : frameU,
      frame ? 1 - (frame.row + crop.top + (1 - frameV) * crop.height) / frame.rows : frameV)
  }
  return geometry
}
