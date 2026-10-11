
 OVERVIEW
 ────────────────────────────────────────────
| key                | value                 |
| ---                | ---                   |
| version            | 2.0                   |
| generator          | glTF-Transform v4.5.1 |
| extensionsUsed     | EXT_texture_webp      |
| extensionsRequired | EXT_texture_webp      |



 SCENES
 ────────────────────────────────────────────
| #   | name            | rootName | bboxMin                    | bboxMax                 | renderVertexCount¹ | uploadVertexCount | uploadNaiveVertexCount |
| --- | ---             | ---      | ---                        | ---                     | ---                | ---               | ---                    |
| 0   | Sketchfab_Scene | Object_4 | -0.621, -0.70978, -1.87933 | 0.621, 0.69484, 1.72275 | 69,612             | 28,368            | 28,368                 |

¹ Expected number of vertices processed by the vertex shader for one render
  pass, without considering the vertex cache.

² Expected number of vertices uploaded to GPU, assuming each Accessor
  is uploaded only once. Actual number uploaded may be higher, 
  dependent on the implementation and vertex buffer layout.

³ Expected number of vertices uploaded to GPU, assuming each Primitive
  is uploaded once, duplicating vertex attributes shared among Primitives.



 MESHES
 ────────────────────────────────────────────
| #   | name      | mode      | meshPrimitives | glPrimitives | vertices | indices | attributes                                            | instances | size¹    |
| --- | ---       | ---       | ---            | ---          | ---      | ---     | ---                                                   | ---       | ---      |
| 0   | Object_0  | TRIANGLES | 1              | 21,404       | 26,818   | u16     | NORMAL:f32, POSITION:f32, TEXCOORD_0:f32              | 1         | 986.6 KB |
| 1   | Object_17 | TRIANGLES | 1              | 1,800        | 1,550    | u16     | NORMAL:f32, POSITION:f32, TANGENT:f32, TEXCOORD_0:f32 | 1         | 85.2 KB  |

⁴ size estimates GPU memory required by a mesh, in isolation. If accessors are
  shared by other mesh primitives, but the meshes themselves are not reused, then
  the sum of all mesh sizes will overestimate the asset's total size. See "dedup".



 MATERIALS
 ────────────────────────────────────────────
| #   | name               | instances | textures                                                    | alphaMode | doubleSided |
| --- | ---                | ---       | ---                                                         | ---       | ---         |
| 0   | Material.118       | 1         | baseColorTexture, normalTexture                             | OPAQUE    | ✓           |
| 1   | PaletteMaterial001 | 1         | baseColorTexture, emissiveTexture, metallicRoughnessTexture | OPAQUE    | ✓           |



 TEXTURES
 ────────────────────────────────────────────
| #   | name                     | uri | slots                           | instances | mimeType   | compression | resolution | size      | gpuSize⁵ |
| --- | ---                      | --- | ---                             | ---       | ---        | ---         | ---        | ---       | ---      |
| 0   |                          |     | baseColorTexture, normalTexture | 1         | image/webp |             | 512x512    | 8.21 KB   | 1.4 MB   |
| 1   | PaletteBaseColor         |     | baseColorTexture                | 1         | image/webp |             | 128x4      | 222 Bytes | 2.81 KB  |
| 2   | PaletteEmissive          |     | emissiveTexture                 | 1         | image/webp |             | 128x4      | 196 Bytes | 2.81 KB  |
| 3   | PaletteMetallicRoughness |     | metallicRoughnessTexture        | 1         | image/webp |             | 128x4      | 276 Bytes | 2.81 KB  |

⁵ gpuSize estimates minimum VRAM memory allocation. Older devices may require
  additional memory for GPU compression formats.



 ANIMATIONS
 ────────────────────────────────────────────
No animations found.

