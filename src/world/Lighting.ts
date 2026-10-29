import { Color, FogExp2, Group, HemisphereLight, PointLight } from 'three';
import type { Scene } from 'three';
import { LIGHT_POSITIONS } from './layout';

export class Lighting {
  readonly root = new Group();

  constructor(scene: Scene) {
    this.root.name = 'Lights';
    scene.background = new Color(0x080f18);
    scene.fog = new FogExp2(0x101e2b, 0.014);
    this.root.add(new HemisphereLight(0x9dcfff, 0x332b22, 1.7));
    for (const [x, y, z] of LIGHT_POSITIONS.slice(0, 3)) {
      const light = new PointLight(0xb9dfff, 85, 32, 1.5);
      light.position.set(x, y, z);
      this.root.add(light);
    }
    const warmLight = new PointLight(0xffb35a, 60, 24, 1.5);
    warmLight.position.set(...LIGHT_POSITIONS[3]);
    this.root.add(warmLight);
    // Broad ambient fill keeps unshadowed cover edges and targets legible.
  }

  dispose(): void { this.root.removeFromParent(); }
}
