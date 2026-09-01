import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { extractSearchTerms, fetchResults } from '../../js/core.js';
import { installFetchMock } from './fixtures.mjs';

// fetchResults() -> loadPapers() calls fetch(); stub it once for the whole file.
installFetchMock();

const titlesOf = (results) => results.map((r) => r.title).sort();

describe('extractSearchTerms', () => {
  test('plain keyword query is treated as AND with no author term', () => {
    const r = extractSearchTerms('cnn transformer');
    assert.deepEqual(r.terms, ['cnn', 'transformer']);
    assert.equal(r.isOrSearch, false);
    assert.equal(r.authorTerm, null);
    assert.deepEqual(r.authorSubTerms, []);
  });

  test('author: prefix with nothing else yields an author term and no keywords', () => {
    const r = extractSearchTerms('author: smith');
    assert.deepEqual(r.terms, []);
    assert.equal(r.authorTerm, 'smith');
    assert.deepEqual(r.authorSubTerms, ['smith']);
  });

  test('author: prefix combined with "and <keyword>" splits into both', () => {
    const r = extractSearchTerms('author: smith and segmentation');
    assert.equal(r.authorTerm, 'smith');
    assert.deepEqual(r.authorSubTerms, ['smith']);
    assert.deepEqual(r.terms, ['segmentation']);
    assert.equal(r.isOrSearch, false);
  });

  test('"or" keyword triggers OR mode', () => {
    const r = extractSearchTerms('cnn or transformer');
    assert.equal(r.isOrSearch, true);
    assert.deepEqual(r.terms, ['cnn', 'transformer']);
  });

  test('comma-separated keywords also trigger OR mode', () => {
    const r = extractSearchTerms('cnn, transformer');
    assert.equal(r.isOrSearch, true);
    assert.deepEqual(r.terms, ['cnn', 'transformer']);
  });

  test('empty query yields no terms and no author', () => {
    const r = extractSearchTerms('   ');
    assert.deepEqual(r, { terms: [], isOrSearch: false, authorTerm: null, authorSubTerms: [] });
  });

  test('single-character terms are dropped', () => {
    const r = extractSearchTerms('a cnn b');
    assert.deepEqual(r.terms, ['cnn']);
  });
});

describe('fetchResults: author search', () => {
  test('author: <name> returns only papers whose authors field contains the name', async () => {
    const { results } = await fetchResults('author: smith');
    assert.deepEqual(titlesOf(results), [
      'Calibration of Deep Neural Network Models',
      'Deep CNN Segmentation of MRI Scans',
    ].sort());
    // the "smith" distractor (word appears in title/abstract, not authors) must be excluded
    assert.ok(!titlesOf(results).includes("Extending Smith's Loss Function for Robust Training"));
  });

  test('author: <name> and <keyword> narrows to papers matching both', async () => {
    const { results } = await fetchResults('author: smith and segmentation');
    assert.equal(results.length, 1);
    assert.equal(results[0].title, 'Deep CNN Segmentation of MRI Scans');
  });

  test('author: <first> <last> requires every author sub-term to match', async () => {
    // "jane smith" both individually appear in paper 1/2's authors field, but
    // "smith lee" (last names from two different papers) must match neither,
    // proving authorSubTerms uses AND (.every), not OR (.some).
    const { results } = await fetchResults('author: smith lee');
    assert.deepEqual(titlesOf(results), ['Deep CNN Segmentation of MRI Scans']);
  });

  test('a plain keyword query does not match on author names', async () => {
    // "smith" only appears in fixture authors for papers 1 and 2; a keyword-only
    // search must not surface them since the keyword blob is title+abstract only.
    const { results } = await fetchResults('smith');
    assert.equal(results.length, 1);
    assert.equal(results[0].title, "Extending Smith's Loss Function for Robust Training");
  });
});

describe('fetchResults: AND vs OR keyword search', () => {
  test('default (AND) requires every term to match', async () => {
    const { results } = await fetchResults('cnn transformer');
    assert.deepEqual(titlesOf(results), [
      'Deep CNN Segmentation of MRI Scans',
      'Transformer Networks for Visual Recognition',
    ].sort());
  });

  test('"or" returns the union of papers matching either term', async () => {
    const { results } = await fetchResults('cnn or transformer');
    assert.deepEqual(titlesOf(results), [
      'Deep CNN Segmentation of MRI Scans',
      'Transformer Networks for Visual Recognition',
      'Federated Learning Survey with CNN Backbones',
    ].sort());
  });
});

describe('fetchResults: keyword matches title and abstract fields', () => {
  test('a term appearing only in the title still matches', async () => {
    const { results } = await fetchResults('graph');
    assert.equal(results.length, 1);
    assert.equal(results[0].title, 'Graph Neural Networks for Chemistry');
    assert.equal(results[0].score, 10); // WEIGHTS.TITLE only
  });

  test('a term appearing only in the abstract still matches', async () => {
    const { results } = await fetchResults('molecule');
    assert.equal(results.length, 1);
    assert.equal(results[0].title, 'Graph Neural Networks for Chemistry');
    assert.equal(results[0].score, 5); // WEIGHTS.ABSTRACT only
  });
});
