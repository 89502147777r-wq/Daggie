
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
| #   | name            | rootName        | bboxMin                          | bboxMax                         | renderVertexCount¹ | uploadVertexCount | uploadNaiveVertexCount |
| --- | ---             | ---             | ---                              | ---                             | ---                | ---               | ---                    |
| 0   | Sketchfab_Scene | Sketchfab_model | -281.87933, -0.03398, -182.14422 | 253.14755, 362.70796, 182.14418 | 74,277             | 14,695            | 14,695                 |

¹ Expected number of vertices processed by the vertex shader for one render
  pass, without considering the vertex cache.

² Expected number of vertices uploaded to GPU, assuming each Accessor
  is uploaded only once. Actual number uploaded may be higher, 
  dependent on the implementation and vertex buffer layout.

³ Expected number of vertices uploaded to GPU, assuming each Primitive
  is uploaded once, duplicating vertex attributes shared among Primitives.



 MESHES
 ────────────────────────────────────────────
| #   | name                   | mode      | meshPrimitives | glPrimitives | vertices | indices | attributes                                            | instances | size¹     |
| --- | ---                    | ---       | ---            | ---          | ---      | ---     | ---                                                   | ---       | ---       |
| 0   | frontTire_frontTireM_0 | TRIANGLES | 1              | 4,672        | 2,746    | u16     | NORMAL:f32, POSITION:f32, TANGENT:f32, TEXCOORD_0:f32 | 1         | 159.84 KB |
| 1   | hull_hullM_0           | TRIANGLES | 1              | 1,489        | 901      | u16     | NORMAL:f32, POSITION:f32, TANGENT:f32, TEXCOORD_0:f32 | 1         | 52.18 KB  |
| 2   | tubeStuff_pipesM_0     | TRIANGLES | 1              | 6,392        | 3,836    | u16     | NORMAL:f32, POSITION:f32, TANGENT:f32, TEXCOORD_0:f32 | 1         | 222.48 KB |
| 3   | tireFlap_wheelFlapM_0  | TRIANGLES | 1              | 752          | 426      | u16     | NORMAL:f32, POSITION:f32, TANGENT:f32, TEXCOORD_0:f32 | 1         | 24.96 KB  |
| 4   | roof_roofM_0           | TRIANGLES | 1              | 322          | 190      | u16     | NORMAL:f32, POSITION:f32, TANGENT:f32, TEXCOORD_0:f32 | 1         | 11.05 KB  |
| 5   | sitBox_sitBoxM_0       | TRIANGLES | 1              | 116          | 230      | u16     | NORMAL:f32, POSITION:f32, TANGENT:f32, TEXCOORD_0:f32 | 1         | 11.74 KB  |
| 6   | roofbeams_roofM_0      | TRIANGLES | 1              | 48           | 96       | u16     | NORMAL:f32, POSITION:f32, TANGENT:f32, TEXCOORD_0:f32 | 1         | 4.9 KB    |
| 7   | wheel_wheelSitM_0      | TRIANGLES | 1              | 2,152        | 1,211    | u16     | NORMAL:f32, POSITION:f32, TANGENT:f32, TEXCOORD_0:f32 | 1         | 71.04 KB  |
| 8   | seat_wheelSitM_0       | TRIANGLES | 1              | 572          | 358      | u16     | NORMAL:f32, POSITION:f32, TANGENT:f32, TEXCOORD_0:f32 | 1         | 20.62 KB  |
| 9   | midBit_bodyM_0         | TRIANGLES | 1              | 1,668        | 970      | u16     | NORMAL:f32, POSITION:f32, TANGENT:f32, TEXCOORD_0:f32 | 1         | 56.57 KB  |
| 10  | backTire_backTireM_0   | TRIANGLES | 1              | 5,888        | 3,318    | u16     | NORMAL:f32, POSITION:f32, TANGENT:f32, TEXCOORD_0:f32 | 1         | 194.59 KB |
| 11  | pipe_hullM_0           | TRIANGLES | 1              | 672          | 397      | u16     | NORMAL:f32, POSITION:f32, TANGENT:f32, TEXCOORD_0:f32 | 1         | 23.09 KB  |
| 12  | foot_bodyM_0           | TRIANGLES | 1              | 16           | 16       | u16     | NORMAL:f32, POSITION:f32, TANGENT:f32, TEXCOORD_0:f32 | 1         | 864 Bytes |

⁴ size estimates GPU memory required by a mesh, in isolation. If accessors are
  shared by other mesh primitives, but the meshes themselves are not reused, then
  the sum of all mesh sizes will overestimate the asset's total size. See "dedup".



 MATERIALS
 ────────────────────────────────────────────
| #   | name       | instances | textures                        | alphaMode | doubleSided |
| --- | ---        | ---       | ---                             | ---       | ---         |
| 0   | frontTireM | 1         | baseColorTexture, normalTexture | OPAQUE    | ✓           |
| 1   | hullM      | 2         | baseColorTexture, normalTexture | OPAQUE    | ✓           |
| 2   | pipesM     | 1         | baseColorTexture, normalTexture | OPAQUE    | ✓           |
| 3   | wheelFlapM | 1         | baseColorTexture, normalTexture | OPAQUE    | ✓           |
| 4   | roofM      | 2         | baseColorTexture, normalTexture | OPAQUE    | ✓           |
| 5   | sitBoxM    | 1         | baseColorTexture, normalTexture | OPAQUE    | ✓           |
| 6   | wheelSitM  | 2         | baseColorTexture, normalTexture | OPAQUE    | ✓           |
| 7   | bodyM      | 2         | baseColorTexture, normalTexture | OPAQUE    | ✓           |
| 8   | backTireM  | 1         | baseColorTexture, normalTexture | OPAQUE    | ✓           |



 TEXTURES
 ────────────────────────────────────────────
| #   | name | uri | slots            | instances | mimeType   | compression | resolution | size     | gpuSize⁵ |
| --- | ---  | --- | ---              | ---       | ---        | ---         | ---        | ---      | ---      |
| 0   |      |     | baseColorTexture | 1         | image/webp |             | 1024x1024  | 12.63 KB | 5.59 MB  |
| 1   |      |     | normalTexture    | 1         | image/webp |             | 1024x1024  | 32.93 KB | 5.59 MB  |
| 2   |      |     | baseColorTexture | 1         | image/webp |             | 1024x1024  | 17.2 KB  | 5.59 MB  |
| 3   |      |     | normalTexture    | 1         | image/webp |             | 1024x1024  | 37.42 KB | 5.59 MB  |
| 4   |      |     | baseColorTexture | 1         | image/webp |             | 1024x1024  | 18.61 KB | 5.59 MB  |
| 5   |      |     | normalTexture    | 1         | image/webp |             | 1024x1024  | 50.78 KB | 5.59 MB  |
| 6   |      |     | baseColorTexture | 1         | image/webp |             | 1024x1024  | 7.96 KB  | 5.59 MB  |
| 7   |      |     | normalTexture    | 1         | image/webp |             | 1024x1024  | 12.45 KB | 5.59 MB  |
| 8   |      |     | baseColorTexture | 1         | image/webp |             | 1024x1024  | 12.1 KB  | 5.59 MB  |
| 9   |      |     | normalTexture    | 1         | image/webp |             | 1024x1024  | 25.8 KB  | 5.59 MB  |
| 10  |      |     | baseColorTexture | 1         | image/webp |             | 1024x1024  | 15.72 KB | 5.59 MB  |
| 11  |      |     | normalTexture    | 1         | image/webp |             | 1024x1024  | 27.57 KB | 5.59 MB  |
| 12  |      |     | baseColorTexture | 1         | image/webp |             | 1024x1024  | 15.99 KB | 5.59 MB  |
| 13  |      |     | normalTexture    | 1         | image/webp |             | 1024x1024  | 20.95 KB | 5.59 MB  |
| 14  |      |     | baseColorTexture | 1         | image/webp |             | 1024x1024  | 13.32 KB | 5.59 MB  |
| 15  |      |     | normalTexture    | 1         | image/webp |             | 1024x1024  | 36.05 KB | 5.59 MB  |
| 16  |      |     | baseColorTexture | 1         | image/webp |             | 1024x1024  | 13.77 KB | 5.59 MB  |
| 17  |      |     | normalTexture    | 1         | image/webp |             | 1024x1024  | 48.78 KB | 5.59 MB  |

⁵ gpuSize estimates minimum VRAM memory allocation. Older devices may require
  additional memory for GPU compression formats.



 ANIMATIONS
 ────────────────────────────────────────────
No animations found.

