// Diffuse opacity of the coloured seal's low, middle and high haze layers.
// Shared with unexplored mist so its density multiplier has the same baseline.
export const SEAL_HAZE_DENSITY_GLSL = /* glsl */ `
  float sealHazeAlpha(float haze, float flecks, float layer) {
    if(layer<.5) return .14+haze*.24+flecks*.05;
    return mix(.080+haze*.25+flecks*.055,.035+haze*.15+flecks*.035,step(1.5,layer))*(.70+flecks*.30);
  }
`
