/**
 * DOM Similarity Comparison Utilities
 *
 * Provides functions to compare two DOM strings and compute similarity scores.
 * Uses a combination of structural and content-based similarity metrics.
 */

interface DOMComparisonResult {
  similarity: number; // 0-100 percentage
  structuralSimilarity: number;
  contentSimilarity: number;
  diff?: DOMDiff;
}

interface DOMDiff {
  added: string[];
  removed: string[];
  modified: string[];
}

/**
 * Compute Levenshtein distance between two strings
 */
function levenshteinDistance(str1: string, str2: string): number {
  const len1 = str1.length;
  const len2 = str2.length;
  const matrix: number[][] = [];

  // Initialize matrix
  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j;
  }

  // Fill matrix
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  return matrix[len1][len2];
}

/**
 * Extract text content from HTML string
 */
function extractTextContent(html: string): string {
  // Remove all tags and get text
  const text = html.replace(/<[^>]*>/g, ' ');
  // Normalize whitespace
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * Extract structural elements (tags and hierarchy)
 */
function extractStructure(html: string): string[] {
  const tags: string[] = [];
  const tagRegex = /<(\w+)[\s>]/g;
  let match;

  while ((match = tagRegex.exec(html)) !== null) {
    tags.push(match[1].toLowerCase());
  }

  return tags;
}

/**
 * Compute similarity between two arrays of tags
 */
function computeArraySimilarity(arr1: string[], arr2: string[]): number {
  if (arr1.length === 0 && arr2.length === 0) return 100;
  if (arr1.length === 0 || arr2.length === 0) return 0;

  // Count matching elements
  const set1 = new Set(arr1);
  const set2 = new Set(arr2);
  const intersection = new Set([...set1].filter(x => set2.has(x)));
  const union = new Set([...set1, ...set2]);

  // Jaccard similarity
  return (intersection.size / union.size) * 100;
}

/**
 * Compute string similarity percentage (0-100)
 */
function computeStringSimilarity(str1: string, str2: string): number {
  if (str1 === str2) return 100;
  if (str1.length === 0 && str2.length === 0) return 100;
  if (str1.length === 0 || str2.length === 0) return 0;

  const maxLen = Math.max(str1.length, str2.length);
  const distance = levenshteinDistance(str1, str2);
  const similarity = ((maxLen - distance) / maxLen) * 100;

  return Math.max(0, Math.min(100, similarity));
}

/**
 * Generate a simple diff between two HTML strings
 */
function generateDiff(html1: string, html2: string): DOMDiff {
  // Simple line-based diff
  const lines1 = html1.split(/>\s*</g).map((l, i, arr) =>
    i === 0 ? l : i === arr.length - 1 ? l : '<' + l + '>'
  );
  const lines2 = html2.split(/>\s*</g).map((l, i, arr) =>
    i === 0 ? l : i === arr.length - 1 ? l : '<' + l + '>'
  );

  const set1 = new Set(lines1);
  const set2 = new Set(lines2);

  const added = [...set2].filter(line => !set1.has(line)).slice(0, 10);
  const removed = [...set1].filter(line => !set2.has(line)).slice(0, 10);

  return {
    added,
    removed,
    modified: []
  };
}

/**
 * Main function to compare two DOM strings
 * Returns a similarity score from 0-100
 */
export function compareDOMSimilarity(dom1: string, dom2: string): DOMComparisonResult {
  // Handle empty cases
  if (!dom1 && !dom2) {
    return {
      similarity: 100,
      structuralSimilarity: 100,
      contentSimilarity: 100
    };
  }

  if (!dom1 || !dom2) {
    return {
      similarity: 0,
      structuralSimilarity: 0,
      contentSimilarity: 0
    };
  }

  // 1. Structural similarity (compare tags and hierarchy)
  const structure1 = extractStructure(dom1);
  const structure2 = extractStructure(dom2);
  const structuralSimilarity = computeArraySimilarity(structure1, structure2);

  // 2. Content similarity (compare visible text)
  const text1 = extractTextContent(dom1);
  const text2 = extractTextContent(dom2);
  const contentSimilarity = computeStringSimilarity(text1, text2);

  // 3. Overall similarity (weighted average)
  // Give more weight to content (70%) than structure (30%)
  const similarity = (contentSimilarity * 0.7) + (structuralSimilarity * 0.3);

  // 4. Generate diff for detailed comparison
  const diff = generateDiff(dom1, dom2);

  return {
    similarity: Math.round(similarity * 10) / 10, // Round to 1 decimal
    structuralSimilarity: Math.round(structuralSimilarity * 10) / 10,
    contentSimilarity: Math.round(contentSimilarity * 10) / 10,
    diff
  };
}

/**
 * Format DOM HTML for display (pretty print with line breaks)
 */
export function formatDOMForDisplay(html: string, maxLength: number = 5000): string {
  if (!html) return 'No DOM data';

  // Truncate if too long
  const truncated = html.length > maxLength ? html.substring(0, maxLength) + '...' : html;

  // Add line breaks after tags for readability
  return truncated
    .replace(/></g, '>\n<')
    .replace(/\s+/g, ' ')
    .trim();
}
