import {
  DataTexture,
  Group,
  Mesh,
  RepeatWrapping,
  UnsignedByteType,
  RGBAFormat,
  type Vector3,
  type BufferGeometry,
  type Material,
  type Texture,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { GAME_CONFIG } from '../shared/config';
import type { Damageable } from '../shared/types';

const DEATH_EFFECT_SECONDS = 0.72;

/** Shared damage, fade and owned-resource lifecycle for enemy implementations. */
export abstract class EnemyBase implements Damageable {
  readonly root = new Group();
  protected readonly geometries = new Set<BufferGeometry>();
  protected readonly materials = new Set<Material>();
  protected readonly textures = new Set<Texture>();
  private health: number = GAME_CONFIG.zombie.health;
  private deathElapsedSeconds = 0;
  private deathStartRotationX = 0;
  private disposed = false;

  protected constructor(readonly id: string) {
    this.root.name = id;
  }

  get isAlive(): boolean { return this.health > 0; }
  get isCleanupReady(): boolean { return !this.isAlive && this.deathElapsedSeconds >= DEATH_EFFECT_SECONDS; }

  spawnAt(position: Vector3): void {
    this.root.position.copy(position);
  }

  takeDamage(amount: number): boolean {
    if (!this.isAlive) return false;
    const damage = Number.isFinite(amount) ? Math.max(0, amount) : 0;
    this.health = Math.max(0, this.health - damage);
    if (!this.isAlive) {
      this.deathElapsedSeconds = 0;
      this.deathStartRotationX = this.root.rotation.x;
      for (const material of this.materials) {
        if ('transparent' in material) {
          material.transparent = true;
          material.depthWrite = false;
        }
      }
    }
    return !this.isAlive;
  }

  update(dtSeconds: number): void {
    if (this.isAlive || this.isCleanupReady) return;
    this.deathElapsedSeconds += Math.max(0, dtSeconds);
    const progress = Math.min(this.deathElapsedSeconds / DEATH_EFFECT_SECONDS, 1);
    const eased = progress * progress * (3 - 2 * progress);
    this.root.rotation.x = this.deathStartRotationX + eased * Math.PI * 0.18;
    this.root.scale.setScalar(1 - eased * 0.16);
    for (const material of this.materials) {
      if ('opacity' in material) material.opacity = 1 - eased;
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.root.removeFromParent();
    for (const geometry of this.geometries) geometry.dispose();
    for (const material of this.materials) material.dispose();
    for (const texture of this.textures) texture.dispose();
    this.geometries.clear();
    this.materials.clear();
    this.textures.clear();
  }

  protected ownGeometry<T extends BufferGeometry>(geometry: T): T {
    this.geometries.add(geometry);
    return geometry;
  }

  protected ownMaterial<T extends Material>(material: T): T {
    this.materials.add(material);
    return material;
  }

  protected ownTexture<T extends Texture>(texture: T): T {
    this.textures.add(texture);
    return texture;
  }

  protected addMesh(
    parent: Group,
    geometry: BufferGeometry,
    material: Material,
    x = 0,
    y = 0,
    z = 0,
    scaleX = 1,
    scaleY = 1,
    scaleZ = 1,
  ): Mesh {
    const mesh = new Mesh(geometry, material);
    mesh.position.set(x, y, z);
    mesh.scale.set(scaleX, scaleY, scaleZ);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  /** Merge static child meshes by material while preserving animated group pivots. */
  protected consolidateMeshes(): void {
    const consolidateGroup = (parent: Group): void => {
      for (const child of [...parent.children]) {
        if (child instanceof Group) consolidateGroup(child);
      }
      const byMaterial = new Map<Material, Mesh[]>();
      for (const child of parent.children) {
        if (!(child instanceof Mesh) || Array.isArray(child.material)) continue;
        const meshes = byMaterial.get(child.material) ?? [];
        meshes.push(child);
        byMaterial.set(child.material, meshes);
      }
      for (const [material, meshes] of byMaterial) {
        if (meshes.length < 2) continue;
        const transformed = meshes.map((mesh) => {
          mesh.updateMatrix();
          const geometry = mesh.geometry.clone();
          geometry.applyMatrix4(mesh.matrix);
          return geometry;
        });
        const merged = mergeGeometries(transformed, false);
        for (const geometry of transformed) geometry.dispose();
        if (!merged) continue;
        this.ownGeometry(merged);
        const consolidatedMesh = new Mesh(merged, material);
        consolidatedMesh.castShadow = true;
        consolidatedMesh.receiveShadow = true;
        parent.remove(...meshes);
        parent.add(consolidatedMesh);
      }
    };

    consolidateGroup(this.root);
    const used = new Set<BufferGeometry>();
    this.root.traverse((object) => {
      if (object instanceof Mesh) used.add(object.geometry);
    });
    for (const geometry of this.geometries) {
      if (!used.has(geometry)) {
        geometry.dispose();
        this.geometries.delete(geometry);
      }
    }
  }

  protected createSurfaceBump(seed: number, size = 64): DataTexture {
    let state = seed >>> 0 || 1;
    const pixels = new Uint8Array(size * size * 4);
    for (let index = 0; index < size * size; index += 1) {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      const noise = 104 + ((state >>> 24) % 48);
      const offset = index * 4;
      pixels[offset] = noise;
      pixels[offset + 1] = noise;
      pixels[offset + 2] = noise;
      pixels[offset + 3] = 255;
    }
    const texture = this.ownTexture(new DataTexture(pixels, size, size, RGBAFormat, UnsignedByteType));
    texture.wrapS = RepeatWrapping;
    texture.wrapT = RepeatWrapping;
    texture.repeat.set(2, 2);
    texture.needsUpdate = true;
    return texture;
  }
}
