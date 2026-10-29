import { ASSETS } from '../shared/assets';

export type WorldPropKind = 'crate' | 'barrel' | 'industrial';

/** Enable a URL only after the actual archive entry and dependencies are included. */
export const WORLD_ASSETS: Record<WorldPropKind, {
  url: string | null;
  heightMetres: number;
  source: string;
}> = {
  crate: { url: null, heightMetres: 1, source: 'https://kenney.nl/assets/factory-kit' },
  barrel: { url: null, heightMetres: 1.1, source: 'https://kenney.nl/assets/factory-kit' },
  industrial: { url: null, heightMetres: 0.18, source: 'https://kenney.nl/assets/factory-kit' },
};

/** Reserved shared URLs apply only if the downloaded files really are GLB. */
export const RESERVED_WORLD_GLB_URLS = { crate: ASSETS.models.crate, barrel: ASSETS.models.barrel };

/** Additional world-only files retain original extensions and relative dependencies. */
export function worldAssetUrl(relativePath: string): string {
  return `${import.meta.env.BASE_URL}models/world/${relativePath}`;
}
