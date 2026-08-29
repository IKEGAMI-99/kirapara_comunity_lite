import { postSsp } from '../lib/kirapara-client.mjs';
import { normalizeMoment } from '../lib/normalize.mjs';

export const discoveryProvider = {
  id: 'discovery',
  label: 'おすすめ',

  async fetchPage() {
    const response = await postSsp('/ss/getDiscoveryList');
    const moments = Array.isArray(response.momentList) ? response.momentList : [];

    return {
      posts: moments
        .filter((moment) => !moment.deleted && !moment.secret)
        .map(normalizeMoment),
      // Pagination is not yet known. Keep the provider contract ready for it.
      nextCursor: null,
    };
  },
};
