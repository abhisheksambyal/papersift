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

  test('a semicolon separates the author clause from the keyword clause', () => {
    const r = extractSearchTerms('author: smith; segmentation');
    assert.equal(r.authorTerm, 'smith');
    assert.deepEqual(r.authorSubTerms, ['smith']);
    assert.deepEqual(r.terms, ['segmentation']);
    assert.equal(r.isOrSearch, false);
  });

  test('the clauses may be given in either order', () => {
    const r = extractSearchTerms('calibration; author: smith');
    assert.equal(r.authorTerm, 'smith');
    assert.deepEqual(r.authorSubTerms, ['smith']);
    assert.deepEqual(r.terms, ['calibration']);
    assert.equal(r.isOrSearch, false);
  });

  test('a comma inside author: separates names, not keywords', () => {
    const r = extractSearchTerms('author: sambyal, usma; classification');
    assert.equal(r.authorTerm, 'sambyal, usma');
    assert.deepEqual(r.authorSubTerms, ['sambyal', 'usma']);
    assert.deepEqual(r.terms, ['classification']);
    // the author comma must not put the keyword clause into OR mode
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

  test('author: <name>; <keyword> narrows to papers matching both', async () => {
    const { results } = await fetchResults('author: smith; segmentation');
    assert.equal(results.length, 1);
    assert.equal(results[0].title, 'Deep CNN Segmentation of MRI Scans');
  });

  test('<keyword>; author: <name> narrows the same way', async () => {
    const { results } = await fetchResults('segmentation; author: smith');
    assert.equal(results.length, 1);
    assert.equal(results[0].title, 'Deep CNN Segmentation of MRI Scans');
  });

  test('author: <a>, <b> requires every author sub-term to match', async () => {
    // "smith" and "lee" are last names from two different papers, so an OR
    // would return both; only the co-authored paper has them together,
    // proving authorSubTerms uses AND (.every), not OR (.some).
    const { results } = await fetchResults('author: smith, lee');
    assert.deepEqual(titlesOf(results), ['Deep CNN Segmentation of MRI Scans']);
  });

  test('multiple author names combine with a keyword clause', async () => {
    const { results } = await fetchResults('author: smith, lee; segmentation');
    assert.deepEqual(titlesOf(results), ['Deep CNN Segmentation of MRI Scans']);
    // the same authors with a keyword they do not match returns nothing
    const { results: none } = await fetchResults('author: smith, lee; molecule');
    assert.deepEqual(none, []);
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
