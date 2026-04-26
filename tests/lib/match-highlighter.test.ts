/**
 * Tests RED — UI Step 1/3 : helper pur de découpage texte/matches
 * pour le composant `<MatchHighlighter />`.
 *
 * Couvre AC-7 (ranges [start, length] corrects) côté rendu UI.
 */

import { describe, expect, it } from "vitest";

import {
  parseTestRegexResponse,
  rangesFromKeywords,
  splitByRanges,
  type MatchRange,
} from "@/lib/match-highlighter";

describe("splitByRanges", () => {
  it("should_return_single_text_segment_when_no_ranges", () => {
    const result = splitByRanges("Hello world", []);
    expect(result).toEqual([{ kind: "text", value: "Hello world" }]);
  });

  it("should_return_empty_array_when_text_is_empty", () => {
    expect(splitByRanges("", [])).toEqual([]);
    expect(splitByRanges("", [{ index: 0, length: 0 }])).toEqual([]);
  });

  it("should_alternate_text_and_match_segments_for_single_range", () => {
    // "FAC-2024" : range starts at 0, length 8 → 1 match seul
    const result = splitByRanges("FAC-2024 voir avant vendredi", [
      { index: 0, length: 8 },
    ]);
    expect(result).toEqual([
      { kind: "match", value: "FAC-2024" },
      { kind: "text", value: " voir avant vendredi" },
    ]);
  });

  it("should_handle_match_in_the_middle_of_text", () => {
    const result = splitByRanges("voir FAC-2024 avant", [
      { index: 5, length: 8 },
    ]);
    expect(result).toEqual([
      { kind: "text", value: "voir " },
      { kind: "match", value: "FAC-2024" },
      { kind: "text", value: " avant" },
    ]);
  });

  it("should_handle_multiple_non_overlapping_ranges", () => {
    const result = splitByRanges("FAC-1 puis FAC-2 fin", [
      { index: 0, length: 5 },
      { index: 11, length: 5 },
    ]);
    expect(result).toEqual([
      { kind: "match", value: "FAC-1" },
      { kind: "text", value: " puis " },
      { kind: "match", value: "FAC-2" },
      { kind: "text", value: " fin" },
    ]);
  });

  it("should_sort_ranges_by_index_to_handle_unsorted_input", () => {
    const ranges: MatchRange[] = [
      { index: 11, length: 5 },
      { index: 0, length: 5 },
    ];
    const result = splitByRanges("FAC-1 puis FAC-2 fin", ranges);
    expect(result.map((s) => s.value)).toEqual(["FAC-1", " puis ", "FAC-2", " fin"]);
  });

  it("should_skip_zero_length_ranges_to_avoid_empty_match_segments", () => {
    const result = splitByRanges("Hello", [{ index: 2, length: 0 }]);
    expect(result).toEqual([{ kind: "text", value: "Hello" }]);
  });

  it("should_clamp_range_extending_beyond_text_length", () => {
    const result = splitByRanges("Short", [{ index: 3, length: 10 }]);
    expect(result).toEqual([
      { kind: "text", value: "Sho" },
      { kind: "match", value: "rt" },
    ]);
  });

  it("should_drop_overlapping_range_to_keep_first_match_winner", () => {
    // 1er match couvre [0..5], 2nd commence à 3 (overlap) → drop le 2nd
    const result = splitByRanges("FAC-2024", [
      { index: 0, length: 5 },
      { index: 3, length: 5 },
    ]);
    expect(result).toEqual([
      { kind: "match", value: "FAC-2" },
      { kind: "text", value: "024" },
    ]);
  });
});

describe("rangesFromKeywords", () => {
  it("should_return_empty_when_no_keywords", () => {
    expect(rangesFromKeywords("Hello world", [])).toEqual([]);
  });

  it("should_match_single_keyword_case_insensitive", () => {
    const ranges = rangesFromKeywords("Le devis arrive demain", ["devis"]);
    expect(ranges).toEqual([{ index: 3, length: 5 }]);
  });

  it("should_match_keyword_in_uppercase_text_when_keyword_lowercase", () => {
    const ranges = rangesFromKeywords("LE DEVIS ARRIVE", ["devis"]);
    expect(ranges).toEqual([{ index: 3, length: 5 }]);
  });

  it("should_match_multiple_occurrences_of_same_keyword", () => {
    const ranges = rangesFromKeywords("devis et devis encore", ["devis"]);
    expect(ranges).toHaveLength(2);
    expect(ranges[0].index).toBe(0);
    expect(ranges[1].index).toBe(9);
  });

  it("should_match_multiple_keywords_at_different_positions", () => {
    const ranges = rangesFromKeywords("envoyer le devis demain", [
      "envoyer",
      "devis",
    ]);
    expect(ranges).toHaveLength(2);
    expect(ranges.map((r) => r.index).sort((a, b) => a - b)).toEqual([0, 11]);
  });

  it("should_use_word_boundary_to_avoid_substring_matches", () => {
    // "devisable" ne doit pas matcher "devis" si word boundary
    const ranges = rangesFromKeywords("le devisable mais aussi devis", ["devis"]);
    expect(ranges).toHaveLength(1);
    expect(ranges[0].index).toBe(24);
  });

  it("should_escape_regex_special_chars_in_keywords", () => {
    // user keyword "C++" ne doit pas crasher
    const ranges = rangesFromKeywords("Job: C++ developer", ["C++"]);
    expect(ranges).toHaveLength(1);
    expect(ranges[0].index).toBe(5);
    expect(ranges[0].length).toBe(3);
  });

  it("should_skip_empty_keywords_silently", () => {
    const ranges = rangesFromKeywords("hello", ["", "  ", "hello"]);
    expect(ranges).toHaveLength(1);
  });

  it("should_return_empty_when_text_is_empty", () => {
    expect(rangesFromKeywords("", ["foo"])).toEqual([]);
  });
});

describe("parseTestRegexResponse", () => {
  it("should_extract_ranges_for_first_textIndex_and_convert_tuples_to_ranges", () => {
    const apiResponse = {
      matches: [
        {
          textIndex: 0,
          ranges: [
            [3, 8] as [number, number], // index 3, length 5
            [15, 23] as [number, number], // index 15, length 8
          ],
        },
      ],
    };
    expect(parseTestRegexResponse(apiResponse)).toEqual([
      { index: 3, length: 5 },
      { index: 15, length: 8 },
    ]);
  });

  it("should_return_empty_when_no_matches_for_text", () => {
    const apiResponse = { matches: [{ textIndex: 0, ranges: [] }] };
    expect(parseTestRegexResponse(apiResponse)).toEqual([]);
  });

  it("should_return_empty_when_matches_array_empty", () => {
    expect(parseTestRegexResponse({ matches: [] })).toEqual([]);
  });

  it("should_return_empty_when_response_malformed", () => {
    expect(parseTestRegexResponse(null)).toEqual([]);
    expect(parseTestRegexResponse({})).toEqual([]);
    expect(parseTestRegexResponse({ matches: null })).toEqual([]);
    expect(parseTestRegexResponse({ matches: [{ textIndex: 0 }] })).toEqual([]);
  });

  it("should_skip_invalid_range_tuples_silently", () => {
    const apiResponse = {
      matches: [
        {
          textIndex: 0,
          ranges: [
            [0, 5],
            [10], // tuple incomplet
            "garbage",
            [20, 15], // end < start
            [30, 35],
          ],
        },
      ],
    };
    expect(parseTestRegexResponse(apiResponse)).toEqual([
      { index: 0, length: 5 },
      { index: 30, length: 5 },
    ]);
  });
});
