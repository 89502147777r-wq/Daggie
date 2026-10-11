
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
| #   | name            | rootName | bboxMin                     | bboxMax                   | renderVertexCount¹ | uploadVertexCount | uploadNaiveVertexCount |
| --- | ---             | ---      | ---                         | ---                       | ---                | ---               | ---                    |
| 0   | Sketchfab_Scene | Object_4 | -5.93271, 0.00038, -1.65745 | 5.93271, 6.25983, 1.42255 | 94,416             | 55,369            | 55,369                 |

¹ Expected number of vertices processed by the vertex shader for one render
  pass, without considering the vertex cache.

² Expected number of vertices uploaded to GPU, assuming each Accessor
  is uploaded only once. Actual number uploaded may be higher, 
  dependent on the implementation and vertex buffer layout.

³ Expected number of vertices uploaded to GPU, assuming each Primitive
  is uploaded once, duplicating vertex attributes shared among Primitives.



 MESHES
 ────────────────────────────────────────────
| #   | name     | mode      | meshPrimitives | glPrimitives | vertices | indices | attributes                               | instances | size¹   |
| --- | ---      | ---       | ---            | ---          | ---      | ---     | ---                                      | ---       | ---     |
| 0   | Object_0 | TRIANGLES | 1              | 31,409       | 55,230   | u16     | NORMAL:f32, POSITION:f32, TEXCOORD_0:f32 | 1         | 1.96 MB |
| 1   | Object_5 | TRIANGLES | 1              | 63           | 139      | u16     | NORMAL:f32, POSITION:f32, TEXCOORD_0:f32 | 1         | 4.83 KB |

⁴ size estimates GPU memory required by a mesh, in isolation. If accessors are
  shared by other mesh primitives, but the meshes themselves are not reused, then
  the sum of all mesh sizes will overestimate the asset's total size. See "dedup".



 MATERIALS
 ────────────────────────────────────────────
| #   | name               | instances | textures         | alphaMode | doubleSided |
| --- | ---                | ---       | ---              | ---       | ---         |
| 0   | PaletteMaterial001 | 1         | baseColorTexture | OPAQUE    | ✓           |
| 1   | PaletteMaterial002 | 1         | baseColorTexture | BLEND     | ✓           |



 TEXTURES
 ────────────────────────────────────────────
| #   | name             | uri | slots            | instances | mimeType   | compression | resolution | size      | gpuSize⁵  |
| --- | ---              | --- | ---              | ---       | ---        | ---         | ---        | ---       | ---       |
| 0   | PaletteBaseColor |     | baseColorTexture | 2         | image/webp |             | 32x4       | 154 Bytes | 700 Bytes |

⁵ gpuSize estimates minimum VRAM memory allocation. Older devices may require
  additional memory for GPU compression formats.



 ANIMATIONS
 ────────────────────────────────────────────
No animations found.

