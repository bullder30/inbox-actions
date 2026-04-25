/**
 * Tests RED — UI Step 1/3 : helper pur de découpage texte/matches
 * pour le composant `<MatchHighlighter />`.
 *
 * Couvre AC-7 (ranges [start, length] corrects) côté rendu UI.
 */

import { describe, expect, it } from "vitest";

import { splitByRanges, type MatchRange } from "@/lib/match-highlighter";

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
