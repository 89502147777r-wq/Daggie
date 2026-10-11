
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
| #   | name            | rootName | bboxMin                      | bboxMax                   | renderVertexCount¹ | uploadVertexCount | uploadNaiveVertexCount |
| --- | ---             | ---      | ---                          | ---                       | ---                | ---               | ---                    |
| 0   | Sketchfab_Scene | Object_5 | -4.06287, -0.18768, -4.11423 | 4.39387, 6.36025, 4.11423 | 38,826             | 8,970             | 8,970                  |

¹ Expected number of vertices processed by the vertex shader for one render
  pass, without considering the vertex cache.

² Expected number of vertices uploaded to GPU, assuming each Accessor
  is uploaded only once. Actual number uploaded may be higher, 
  dependent on the implementation and vertex buffer layout.

³ Expected number of vertices uploaded to GPU, assuming each Primitive
  is uploaded once, duplicating vertex attributes shared among Primitives.



 MESHES
 ────────────────────────────────────────────
| #   | name      | mode      | meshPrimitives | glPrimitives | vertices | indices | attributes                                                            | instances | size¹     |
| --- | ---       | ---       | ---            | ---          | ---      | ---     | ---                                                                   | ---       | ---       |
| 0   | Object_0  | TRIANGLES | 1              | 44           | 86       | u16     | NORMAL:f32, POSITION:f32, TEXCOORD_0:f32                              | 1         | 3.02 KB   |
| 1   | Object_1  | TRIANGLES | 1              | 12           | 24       | u16     | NORMAL:f32, POSITION:f32, TEXCOORD_0:f32                              | 1         | 840 Bytes |
| 2   | Object_2  | TRIANGLES | 1              | 144          | 286      | u16     | NORMAL:f32, POSITION:f32, TANGENT:f32, TEXCOORD_0:f32                 | 1         | 14.59 KB  |
| 3   | Object_4  | TRIANGLES | 1              | 8,366        | 5,634    | u16     | NORMAL:f32, POSITION:f32, TANGENT:f32, TEXCOORD_0:f32, TEXCOORD_1:f32 | 1         | 365.7 KB  |
| 4   | Object_5  | TRIANGLES | 1              | 960          | 1,003    | u16     | NORMAL:f32, POSITION:f32, TANGENT:f32, TEXCOORD_0:f32                 | 1         | 53.9 KB   |
| 5   | Object_49 | TRIANGLES | 1              | 3,360        | 1,903    | u16     | NORMAL:f32, POSITION:f32                                              | 1         | 65.83 KB  |
| 6   | Object_51 | TRIANGLES | 1              | 2            | 4        | u16     | NORMAL:f32, POSITION:f32                                              | 1         | 108 Bytes |
| 7   | Object_52 | TRIANGLES | 1              | 54           | 30       | u16     | NORMAL:f32, POSITION:f32                                              | 1         | 1.04 KB   |

⁴ size estimates GPU memory required by a mesh, in isolation. If accessors are
  shared by other mesh primitives, but the meshes themselves are not reused, then
  the sum of all mesh sizes will overestimate the asset's total size. See "dedup".



 MATERIALS
 ────────────────────────────────────────────
| #   | name         | instances | textures                        | alphaMode | doubleSided |
| --- | ---          | ---       | ---                             | ---       | ---         |
| 0   | mBrick       | 1         | baseColorTexture                | OPAQUE    | ✓           |
| 1   | mDoor        | 1         | baseColorTexture                | OPAQUE    | ✓           |
| 2   | mWood        | 1         | baseColorTexture, normalTexture | OPAQUE    | ✓           |
| 3   | mLogSide     | 1         | baseColorTexture, normalTexture | OPAQUE    | ✓           |
| 4   | mLogFront    | 1         | baseColorTexture, normalTexture | OPAQUE    | ✓           |
| 5   | mSnow        | 2         |                                 | OPAQUE    | ✓           |
| 6   | mWindowGlass | 1         |                                 | OPAQUE    | ✓           |



 TEXTURES
 ────────────────────────────────────────────
| #   | name | uri | slots            | instances | mimeType   | compression | resolution | size      | gpuSize⁵  |
| --- | ---  | --- | ---              | ---       | ---        | ---         | ---        | ---       | ---       |
| 0   |      |     | baseColorTexture | 1         | image/webp |             | 256x256    | 17.47 KB  | 349.52 KB |
| 1   |      |     | baseColorTexture | 1         | image/webp |             | 512x512    | 65.64 KB  | 1.4 MB    |
| 2   |      |     | baseColorTexture | 1         | image/webp |             | 512x512    | 75.27 KB  | 1.4 MB    |
| 3   |      |     | normalTexture    | 1         | image/webp |             | 512x512    | 157.77 KB | 1.4 MB    |
| 4   |      |     | baseColorTexture | 1         | image/webp |             | 1024x1024  | 212.14 KB | 5.59 MB   |
| 5   |      |     | normalTexture    | 1         | image/webp |             | 512x512    | 158.63 KB | 1.4 MB    |
| 6   |      |     | baseColorTexture | 1         | image/webp |             | 1024x1024  | 232.14 KB | 5.59 MB   |
| 7   |      |     | normalTexture    | 1         | image/webp |             | 512x512    | 130.83 KB | 1.4 MB    |

⁵ gpuSize estimates minimum VRAM memory allocation. Older devices may require
  additional memory for GPU compression formats.



 ANIMATIONS
 ────────────────────────────────────────────
No animations found.

