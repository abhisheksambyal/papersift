"""Regression tests for api.search.run_search().

These tests bypass api.search._build_index() (which fetches live conference
data over the network) by monkeypatching the module-level `_index` cache
directly with a small fixture dataset, so they run offline and deterministically.

Several tests intentionally pin *current* behavior of run_search() that differs
from the richer client-side search in js/core.js (no `author:` prefix support,
no real OR logic) -- see comments below. These are not bugs to fix here; they
document the gap so a future change to either implementation is caught.
"""
import os
import sys
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))

from api import search  # noqa: E402
from fixtures import build_fixture_index  # noqa: E402


def titles_of(results):
    return sorted(r["title"] for r in results)


class RunSearchTests(unittest.TestCase):
    def setUp(self):
        self._original_index = search._index
        search._index = build_fixture_index()

    def tearDown(self):
        search._index = self._original_index

    def test_keyword_matches_via_authors_field_unlike_js(self):
        # Unlike core.js (whose keyword blob is title+abstract only), Python's
        # _all blob includes the authors field, so a plain keyword search DOES
        # match on author names here.
        results = search.run_search("smith")
        self.assertEqual(
            titles_of(results),
            sorted(
                [
                    "Deep CNN Segmentation of MRI Scans",  # matches via authors "Jane Smith"
                    "Calibration of Deep Neural Network Models",  # matches via authors "Jane Smith"
                    "Extending Smith's Loss Function for Robust Training",  # matches via title+abstract
                ]
            ),
        )

    def test_implicit_and_requires_every_term(self):
        results = search.run_search("cnn transformer")
        self.assertEqual(
            titles_of(results),
            sorted(
                [
                    "Deep CNN Segmentation of MRI Scans",
                    "Transformer Networks for Visual Recognition",
                ]
            ),
        )
        # "Federated Learning Survey with CNN Backbones" has "cnn" but not
        # "transformer", so strict AND correctly excludes it.
        self.assertNotIn(
            "Federated Learning Survey with CNN Backbones", titles_of(results)
        )

    def test_or_keyword_is_not_real_or_logic(self):
        # "or" happens to be filtered out as a 2-character term (len(t) > 2),
        # so "cnn or transformer" degrades to an implicit AND of "cnn" and
        # "transformer" -- identical to the AND-only query above, NOT a union.
        or_results = search.run_search("cnn or transformer")
        and_results = search.run_search("cnn transformer")
        self.assertEqual(titles_of(or_results), titles_of(and_results))
        # A paper matching only "cnn" is excluded even though a real OR
        # search would include it.
        self.assertNotIn(
            "Federated Learning Survey with CNN Backbones", titles_of(or_results)
        )

    def test_two_character_terms_are_dropped(self):
        # "ai" (2 chars) is filtered by `len(t) > 2`, so it has no effect on
        # the result set.
        with_short_term = search.run_search("ai cnn")
        without_short_term = search.run_search("cnn")
        self.assertEqual(titles_of(with_short_term), titles_of(without_short_term))
        self.assertEqual(
            titles_of(without_short_term),
            sorted(
                [
                    "Deep CNN Segmentation of MRI Scans",
                    "Transformer Networks for Visual Recognition",
                    "Federated Learning Survey with CNN Backbones",
                ]
            ),
        )

    def test_author_prefix_is_not_special_cased(self):
        # run_search() has no concept of "author:" -- it's tokenized as a
        # literal word ("author:") that won't appear in any real blob, so a
        # query written in the js/core.js author-search syntax returns
        # nothing here. This documents the gap vs. extractSearchTerms().
        results = search.run_search("author: smith")
        self.assertEqual(results, [])

    def test_venue_filter_without_keywords(self):
        results = search.run_search("", venue=["miccai"])
        self.assertEqual(
            titles_of(results),
            sorted(
                [
                    "Deep CNN Segmentation of MRI Scans",
                    "Calibration of Deep Neural Network Models",
                ]
            ),
        )

    def test_year_filter_combined_with_keyword(self):
        results = search.run_search("learning", year=["2023"])
        self.assertEqual(
            titles_of(results), ["Federated Learning Survey with CNN Backbones"]
        )


if __name__ == "__main__":
    unittest.main()
