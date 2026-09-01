// Deterministic paper fixtures + a fetch() stub for testing js/core.js without
// touching the network or the real data/*.json files.

export const FIXTURE_PAPERS = [
  {
    // author search target #1: has "segmentation" in title+abstract
    title: 'Deep CNN Segmentation of MRI Scans',
    authors: 'Jane Smith, Bob Lee',
    url: 'https://example.org/paper-1',
    venue: 'MICCAI 2021',
    year: '2021',
    abstract: 'We propose a transformer-based approach for medical image segmentation.',
  },
  {
    // author search target #2: same author, no "segmentation"
    title: 'Calibration of Deep Neural Network Models',
    authors: 'Jane Smith',
    url: 'https://example.org/paper-2',
    venue: 'MICCAI 2019',
    year: '2019',
    abstract: 'We analyze confidence calibration techniques for classifiers.',
  },
  {
    // distractor: "smith" appears in title/abstract but NOT in authors
    title: "Extending Smith's Loss Function for Robust Training",
    authors: 'David Kim',
    url: 'https://example.org/paper-3',
    venue: 'AAAI 2021',
    year: '2021',
    abstract: 'We build on the smith regularizer to improve robustness.',
  },
  {
    // criss-cross with paper 1: "cnn" in abstract, "transformer" in title
    title: 'Transformer Networks for Visual Recognition',
    authors: 'Alice Doe',
    url: 'https://example.org/paper-4',
    venue: 'CVPR 2022',
    year: '2022',
    abstract: 'This work explores CNN alternatives for vision tasks.',
  },
  {
    // has "cnn" but NOT "transformer" - distinguishes AND from OR
    title: 'Federated Learning Survey with CNN Backbones',
    authors: 'Carol White, David Kim',
    url: 'https://example.org/paper-5',
    venue: 'ICML 2023',
    year: '2023',
    abstract: 'A survey of federated learning techniques.',
  },
  {
    // "graph" only in title, "molecule" only in abstract
    title: 'Graph Neural Networks for Chemistry',
    authors: 'Bob Lee, Carol White',
    url: 'https://example.org/paper-6',
    venue: 'NeurIPS 2020',
    year: '2020',
    abstract: 'We study molecule embeddings for property prediction tasks.',
  },
];

const FIXTURE_CONFIG = { conferences: [{ id: 'fixture' }] };

/**
 * Stubs globalThis.fetch so js/core.js's loadPapers() resolves the fixture
 * data above instead of hitting the network. Call once before any test that
 * exercises fetchResults()/loadPapers().
 */
export function installFetchMock() {
  globalThis.fetch = async (url) => {
    if (String(url).includes('config.json')) {
      return { ok: true, json: async () => FIXTURE_CONFIG };
    }
    if (String(url).includes('fixture.json')) {
      return { ok: true, json: async () => FIXTURE_PAPERS };
    }
    throw new Error(`Unexpected fetch() call in test: ${url}`);
  };
}
