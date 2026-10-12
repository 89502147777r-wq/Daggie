
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
| #   | name            | rootName | bboxMin                     | bboxMax                    | renderVertexCount¹ | uploadVertexCount | uploadNaiveVertexCount |
| --- | ---             | ---      | ---                         | ---                        | ---                | ---               | ---                    |
| 0   | Sketchfab_Scene | Object_2 | -2.50898, 1.37368, -5.65016 | 7.05549, 17.7716, 10.10573 | 30,627             | 7,172             | 7,172                  |

¹ Expected number of vertices processed by the vertex shader for one render
  pass, without considering the vertex cache.

² Expected number of vertices uploaded to GPU, assuming each Accessor
  is uploaded only once. Actual number uploaded may be higher, 
  dependent on the implementation and vertex buffer layout.

³ Expected number of vertices uploaded to GPU, assuming each Primitive
  is uploaded once, duplicating vertex attributes shared among Primitives.



 MESHES
 ────────────────────────────────────────────
| #   | name     | mode      | meshPrimitives | glPrimitives | vertices | indices | attributes                                            | instances | size¹     |
| --- | ---      | ---       | ---            | ---          | ---      | ---     | ---                                                   | ---       | ---       |
| 0   | Object_0 | TRIANGLES | 1              | 2            | 4        | u16     | NORMAL:f32, POSITION:f32, TEXCOORD_0:f32              | 1         | 140 Bytes |
| 1   | Object_1 | TRIANGLES | 1              | 2,160        | 1,351    | u16     | NORMAL:f32, POSITION:f32, TEXCOORD_0:f32              | 1         | 56.19 KB  |
| 2   | Object_2 | TRIANGLES | 1              | 1,654        | 1,413    | u16     | NORMAL:f32, POSITION:f32, TANGENT:f32, TEXCOORD_0:f32 | 1         | 77.75 KB  |
| 3   | Object_3 | TRIANGLES | 1              | 2,677        | 1,595    | u16     | NORMAL:f32, POSITION:f32, TEXCOORD_0:f32              | 1         | 67.1 KB   |
| 4   | Object_5 | TRIANGLES | 1              | 1,226        | 819      | u16     | NORMAL:f32, POSITION:f32, TEXCOORD_0:f32              | 1         | 33.56 KB  |
| 5   | Object_6 | TRIANGLES | 1              | 2,490        | 1,990    | u16     | NORMAL:f32, POSITION:f32, TANGENT:f32, TEXCOORD_0:f32 | 1         | 110.46 KB |

⁴ size estimates GPU memory required by a mesh, in isolation. If accessors are
  shared by other mesh primitives, but the meshes themselves are not reused, then
  the sum of all mesh sizes will overestimate the asset's total size. See "dedup".



 MATERIALS
 ────────────────────────────────────────────
| #   | name                                                      | instances | textures                                         | alphaMode | doubleSided |
| --- | ---                                                       | ---       | ---                                              | ---       | ---         |
| 0   | blinn4SG                                                  | 1         | baseColorTexture, emissiveTexture                | OPAQUE    | ✓           |
| 1   | blinn7SG                                                  | 1         | baseColorTexture, emissiveTexture, normalTexture | OPAQUE    | ✓           |
| 2   | blinn8SG                                                  | 1         | baseColorTexture, emissiveTexture                | OPAQUE    | ✓           |
| 3   | pasted__pasted__blinn8SG1                                 | 1         | baseColorTexture, emissiveTexture                | OPAQUE    | ✓           |
| 4   | pasted__pasted__pasted__blinn1SG                          | 1         | baseColorTexture, emissiveTexture                | OPAQUE    | ✓           |
| 5   | pasted__pasted__pasted__pasted__pasted__pasted__blinn5SG1 | 1         | baseColorTexture, emissiveTexture, normalTexture | OPAQUE    | ✓           |



 TEXTURES
 ────────────────────────────────────────────
| #   | name | uri | slots                             | instances | mimeType   | compression | resolution | size      | gpuSize⁵ |
| --- | ---  | --- | ---                               | ---       | ---        | ---         | ---        | ---       | ---      |
| 0   |      |     | baseColorTexture                  | 1         | image/webp |             | 1024x256   | 7.67 KB   | 1.4 MB   |
| 1   |      |     | emissiveTexture                   | 1         | image/webp |             | 1024x256   | 8.16 KB   | 1.4 MB   |
| 2   |      |     | baseColorTexture, emissiveTexture | 1         | image/webp |             | 1024x1024  | 121.69 KB | 5.59 MB  |
| 3   |      |     | normalTexture                     | 1         | image/webp |             | 1024x1024  | 103.4 KB  | 5.59 MB  |
| 4   |      |     | baseColorTexture, emissiveTexture | 2         | image/webp |             | 1024x1024  | 106.4 KB  | 5.59 MB  |
| 5   |      |     | baseColorTexture, emissiveTexture | 1         | image/webp |             | 1024x1024  | 11.41 KB  | 5.59 MB  |
| 6   |      |     | baseColorTexture                  | 1         | image/webp |             | 1024x1024  | 290.96 KB | 5.59 MB  |
| 7   |      |     | emissiveTexture                   | 1         | image/webp |             | 1024x1024  | 329.11 KB | 5.59 MB  |
| 8   |      |     | normalTexture                     | 1         | image/webp |             | 1024x1024  | 309.01 KB | 5.59 MB  |

⁵ gpuSize estimates minimum VRAM memory allocation. Older devices may require
  additional memory for GPU compression formats.



 ANIMATIONS
 ────────────────────────────────────────────
No animations found.

