
 OVERVIEW
 ────────────────────────────────────────────
| key                | value                                        |
| ---                | ---                                          |
| version            | 2.0                                          |
| generator          | glTF-Transform v4.5.1                        |
| extensionsUsed     | EXT_texture_webp, KHR_materials_transmission |
| extensionsRequired | EXT_texture_webp                             |



 SCENES
 ────────────────────────────────────────────
| #   | name            | rootName | bboxMin                     | bboxMax                   | renderVertexCount¹ | uploadVertexCount | uploadNaiveVertexCount |
| --- | ---             | ---      | ---                         | ---                       | ---                | ---               | ---                    |
| 0   | Sketchfab_Scene | Object_2 | -0.42892, 0.00237, -0.61783 | 0.43819, 2.19961, 0.64148 | 62,568             | 21,987            | 21,987                 |

¹ Expected number of vertices processed by the vertex shader for one render
  pass, without considering the vertex cache.

² Expected number of vertices uploaded to GPU, assuming each Accessor
  is uploaded only once. Actual number uploaded may be higher, 
  dependent on the implementation and vertex buffer layout.

³ Expected number of vertices uploaded to GPU, assuming each Primitive
  is uploaded once, duplicating vertex attributes shared among Primitives.



 MESHES
 ────────────────────────────────────────────
| #   | name      | mode      | meshPrimitives | glPrimitives | vertices | indices | attributes                                            | instances | size¹     |
| --- | ---       | ---       | ---            | ---          | ---      | ---     | ---                                                   | ---       | ---       |
| 0   | Object_0  | TRIANGLES | 1              | 858          | 507      | u16     | NORMAL:f32, POSITION:f32, TEXCOORD_0:f32              | 1         | 21.37 KB  |
| 1   | Object_1  | TRIANGLES | 1              | 188          | 200      | u16     | NORMAL:f32, POSITION:f32, TEXCOORD_0:f32              | 1         | 7.53 KB   |
| 2   | Object_2  | TRIANGLES | 1              | 128          | 128      | u16     | NORMAL:f32, POSITION:f32, TEXCOORD_0:f32              | 1         | 4.86 KB   |
| 3   | Object_3  | TRIANGLES | 1              | 128          | 128      | u16     | NORMAL:f32, POSITION:f32, TEXCOORD_0:f32              | 1         | 4.86 KB   |
| 4   | Object_4  | TRIANGLES | 1              | 10,686       | 12,518   | u16     | NORMAL:f32, POSITION:f32, TEXCOORD_0:f32              | 1         | 464.69 KB |
| 5   | Object_6  | TRIANGLES | 1              | 1,110        | 1,142    | u16     | NORMAL:f32, POSITION:f32, TEXCOORD_0:f32              | 1         | 43.2 KB   |
| 6   | Object_8  | TRIANGLES | 1              | 555          | 565      | u16     | NORMAL:f32, POSITION:f32, TEXCOORD_0:f32              | 1         | 21.41 KB  |
| 7   | Object_9  | TRIANGLES | 1              | 2,475        | 2,233    | u16     | NORMAL:f32, POSITION:f32, TEXCOORD_0:f32              | 1         | 86.31 KB  |
| 8   | Object_10 | TRIANGLES | 1              | 869          | 485      | u16     | NORMAL:f32, POSITION:f32, TEXCOORD_0:f32              | 1         | 20.73 KB  |
| 9   | Object_14 | TRIANGLES | 1              | 44           | 96       | u16     | NORMAL:f32, POSITION:f32, TANGENT:f32, TEXCOORD_0:f32 | 1         | 4.87 KB   |
| 10  | Object_15 | TRIANGLES | 1              | 186          | 204      | u16     | NORMAL:f32, POSITION:f32, TEXCOORD_0:f32              | 1         | 7.64 KB   |
| 11  | Object_16 | TRIANGLES | 1              | 320          | 504      | u16     | NORMAL:f32, POSITION:f32, TANGENT:f32, TEXCOORD_0:f32 | 1         | 26.11 KB  |
| 12  | Object_17 | TRIANGLES | 1              | 272          | 287      | u16     | NORMAL:f32, POSITION:f32, TEXCOORD_0:f32              | 1         | 10.82 KB  |
| 13  | Object_18 | TRIANGLES | 1              | 7            | 9        | u16     | NORMAL:f32, POSITION:f32, TEXCOORD_0:f32              | 1         | 330 Bytes |
| 14  | Object_19 | TRIANGLES | 1              | 17           | 19       | u16     | NORMAL:f32, POSITION:f32, TEXCOORD_0:f32              | 1         | 710 Bytes |
| 15  | Object_20 | TRIANGLES | 1              | 96           | 130      | u16     | NORMAL:f32, POSITION:f32, TEXCOORD_0:f32              | 1         | 4.74 KB   |
| 16  | Object_22 | TRIANGLES | 1              | 630          | 670      | u16     | NORMAL:f32, POSITION:f32, TEXCOORD_0:f32              | 1         | 25.22 KB  |
| 17  | Object_23 | TRIANGLES | 1              | 665          | 513      | u16     | NORMAL:f32, POSITION:f32, TEXCOORD_0:f32              | 1         | 20.41 KB  |
| 18  | Object_24 | TRIANGLES | 1              | 640          | 426      | u16     | NORMAL:f32, POSITION:f32, TEXCOORD_0:f32              | 1         | 17.47 KB  |
| 19  | Object_28 | TRIANGLES | 1              | 622          | 743      | u16     | NORMAL:f32, POSITION:f32, TEXCOORD_0:f32              | 1         | 27.51 KB  |
| 20  | Object_31 | TRIANGLES | 1              | 90           | 150      | u16     | NORMAL:f32, POSITION:f32, TEXCOORD_0:f32              | 1         | 5.34 KB   |
| 21  | Object_34 | TRIANGLES | 1              | 270          | 330      | u16     | NORMAL:f32, POSITION:f32, TEXCOORD_0:f32              | 1         | 12.18 KB  |

⁴ size estimates GPU memory required by a mesh, in isolation. If accessors are
  shared by other mesh primitives, but the meshes themselves are not reused, then
  the sum of all mesh sizes will overestimate the asset's total size. See "dedup".



 MATERIALS
 ────────────────────────────────────────────
| #   | name                            | instances | textures                                   | alphaMode | doubleSided |
| --- | ---                             | ---       | ---                                        | ---       | ---         |
| 0   | Bottle_Tea_lable_base           | 1         | baseColorTexture                           | OPAQUE    | ✓           |
| 1   | Can_1                           | 1         | baseColorTexture                           | OPAQUE    | ✓           |
| 2   | Can_11                          | 1         | baseColorTexture                           | OPAQUE    | ✓           |
| 3   | Can_11.001                      | 1         | baseColorTexture                           | OPAQUE    | ✓           |
| 4   | Can_2                           | 1         | baseColorTexture                           | OPAQUE    | ✓           |
| 5   | Can_6                           | 1         | baseColorTexture                           | OPAQUE    | ✓           |
| 6   | Can_7                           | 1         | baseColorTexture                           | OPAQUE    | ✓           |
| 7   | Can_8                           | 1         | baseColorTexture                           | OPAQUE    | ✓           |
| 8   | Can_9                           | 1         | baseColorTexture                           | OPAQUE    | ✓           |
| 9   | Cap_10                          | 1         | baseColorTexture                           | OPAQUE    | ✓           |
| 10  | Concrete_Floor_vlklbin          | 1         | normalTexture, metallicRoughnessTexture    | OPAQUE    | ✓           |
| 11  | Scratched_Painted_Metal_vbiiegp | 1         | normalTexture, metallicRoughnessTexture    | OPAQUE    | ✓           |
| 12  | Vending_1                       | 1         | baseColorTexture                           | OPAQUE    | ✓           |
| 13  | Vending_1_sign_1                | 1         | baseColorTexture                           | OPAQUE    | ✓           |
| 14  | Vending_1_sign_2                | 1         | baseColorTexture                           | OPAQUE    | ✓           |
| 15  | Vending_price_1                 | 1         | baseColorTexture                           | OPAQUE    | ✓           |
| 16  | PaletteMaterial001              | 1         | baseColorTexture, metallicRoughnessTexture | OPAQUE    | ✓           |
| 17  | PaletteMaterial002              | 1         | baseColorTexture, metallicRoughnessTexture | BLEND     | ✓           |
| 18  | PaletteMaterial003              | 1         | baseColorTexture, metallicRoughnessTexture | OPAQUE    | ✓           |
| 19  | PaletteMaterial004              | 1         | baseColorTexture, metallicRoughnessTexture | OPAQUE    | ✓           |
| 20  | PaletteMaterial005              | 1         | baseColorTexture, metallicRoughnessTexture | BLEND     | ✓           |
| 21  | PaletteMaterial006              | 1         | baseColorTexture, metallicRoughnessTexture | OPAQUE    | ✓           |



 TEXTURES
 ────────────────────────────────────────────
| #   | name                     | uri | slots                    | instances | mimeType   | compression | resolution | size      | gpuSize⁵  |
| --- | ---                      | --- | ---                      | ---       | ---        | ---         | ---        | ---       | ---       |
| 0   |                          |     | baseColorTexture         | 1         | image/webp |             | 512x1024   | 31.29 KB  | 2.8 MB    |
| 1   |                          |     | baseColorTexture         | 1         | image/webp |             | 256x256    | 4.16 KB   | 349.52 KB |
| 2   |                          |     | baseColorTexture         | 1         | image/webp |             | 256x256    | 8.29 KB   | 349.52 KB |
| 3   |                          |     | baseColorTexture         | 1         | image/webp |             | 256x256    | 4.75 KB   | 349.52 KB |
| 4   |                          |     | baseColorTexture         | 1         | image/webp |             | 512x512    | 21.45 KB  | 1.4 MB    |
| 5   |                          |     | baseColorTexture         | 1         | image/webp |             | 512x128    | 19.14 KB  | 349.53 KB |
| 6   |                          |     | baseColorTexture         | 1         | image/webp |             | 1024x512   | 88.4 KB   | 2.8 MB    |
| 7   |                          |     | baseColorTexture         | 1         | image/webp |             | 512x1024   | 20.65 KB  | 2.8 MB    |
| 8   |                          |     | baseColorTexture         | 1         | image/webp |             | 256x256    | 4.35 KB   | 349.52 KB |
| 9   |                          |     | baseColorTexture         | 1         | image/webp |             | 512x256    | 7.51 KB   | 699.05 KB |
| 10  |                          |     | metallicRoughnessTexture | 1         | image/webp |             | 1024x512   | 1.9 KB    | 2.8 MB    |
| 11  |                          |     | normalTexture            | 1         | image/webp |             | 1024x512   | 165.99 KB | 2.8 MB    |
| 12  |                          |     | metallicRoughnessTexture | 1         | image/webp |             | 1024x512   | 3.52 KB   | 2.8 MB    |
| 13  |                          |     | normalTexture            | 1         | image/webp |             | 1024x512   | 1.07 KB   | 2.8 MB    |
| 14  |                          |     | baseColorTexture         | 3         | image/webp |             | 1024x1024  | 203.38 KB | 5.59 MB   |
| 15  |                          |     | baseColorTexture         | 1         | image/webp |             | 1024x256   | 28.98 KB  | 1.4 MB    |
| 16  | PaletteBaseColor         |     | baseColorTexture         | 6         | image/webp |             | 128x4      | 260 Bytes | 2.81 KB   |
| 17  | PaletteMetallicRoughness |     | metallicRoughnessTexture | 6         | image/webp |             | 128x4      | 258 Bytes | 2.81 KB   |

⁵ gpuSize estimates minimum VRAM memory allocation. Older devices may require
  additional memory for GPU compression formats.



 ANIMATIONS
 ────────────────────────────────────────────
No animations found.

