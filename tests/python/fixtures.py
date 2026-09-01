"""Deterministic paper fixtures for testing api.search.run_search().

Mirrors the shape api.search._build_index() produces internally: a list of
(lowered, normalized) tuples. Building these fixtures directly lets tests
bypass _build_index()'s live network fetchers entirely.
"""

# (title, authors, url, venue, year, abstract)
FIXTURE_RAW = [
    (
        "Deep CNN Segmentation of MRI Scans",
        "Jane Smith, Bob Lee",
        "https://example.org/paper-1",
        "MICCAI 2021",
        "2021",
        "We propose a transformer-based approach for medical image segmentation.",
    ),
    (
        "Calibration of Deep Neural Network Models",
        "Jane Smith",
        "https://example.org/paper-2",
        "MICCAI 2019",
        "2019",
        "We analyze confidence calibration techniques for classifiers.",
    ),
    (
        "Extending Smith's Loss Function for Robust Training",
        "David Kim",
        "https://example.org/paper-3",
        "AAAI 2021",
        "2021",
        "We build on the smith regularizer to improve robustness.",
    ),
    (
        "Transformer Networks for Visual Recognition",
        "Alice Doe",
        "https://example.org/paper-4",
        "CVPR 2022",
        "2022",
        "This work explores CNN alternatives for vision tasks.",
    ),
    (
        "Federated Learning Survey with CNN Backbones",
        "Carol White, David Kim",
        "https://example.org/paper-5",
        "ICML 2023",
        "2023",
        "A survey of federated learning techniques.",
    ),
    (
        "Graph Neural Networks for Chemistry",
        "Bob Lee, Carol White",
        "https://example.org/paper-6",
        "NeurIPS 2020",
        "2020",
        "We study molecule embeddings for property prediction tasks.",
    ),
]


def _entry(title, authors, url, venue, year, abstract):
    normalized = {
        "title": title,
        "authors": authors,
        "url": url,
        "venue": venue,
        "year": year,
        "abstract": abstract,
    }
    lowered = {
        "title": title.lower(),
        "authors": authors.lower(),
        "abstract": abstract.lower(),
        "venue": venue.lower(),
        "_all": f"{title} {authors} {abstract} {venue}".lower(),
    }
    return (lowered, normalized)


def build_fixture_index():
    return [_entry(*row) for row in FIXTURE_RAW]
