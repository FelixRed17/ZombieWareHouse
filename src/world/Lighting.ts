import { Color, FogExp2, Group, HemisphereLight, PointLight } from 'three';
import type { Scene } from 'three';

export class Lighting {
  readonly root = new Group();

  constructor(scene: Scene) {
    this.root.name = 'Lights';
    scene.background = new Color(0x080f18);
    scene.fog = new FogExp2(0x101e2b, 0.022);
    this.root.add(new HemisphereLight(0x9dcfff, 0x332b22, 1.7));
    for (const z of [-18, 0, 18]) {
      const light = new PointLight(0xb9dfff, 85, 32, 1.5);
      light.position.set(-4, 7, z);
      this.root.add(light);
    }
    const warmLight = new PointLight(0xffb35a, 60, 24, 1.5);
    warmLight.position.set(13, 5, -10);
    this.root.add(warmLight);
    // TODO(P3-01): tune visibility and optionally add a small shadow budget.
  }

  dispose(): void { this.root.removeFromParent(); }
}
