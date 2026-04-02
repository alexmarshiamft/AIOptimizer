import * as cheerio from 'cheerio';
import type { RawFindings, Recommendation } from './database';

export interface ScanProgress {
  type: 'log' | 'complete' | 'error';
  message?: string;
  tag?: string;
  data?: object;
}

export async function* scanUrl(url: string): AsyncGenerator<ScanProgress> {
  yield { type: 'log', tag: 'INIT', message: `Initializing scan for ${url}` };
  yield { type: 'log', tag: 'FETCH', message: `Establishing connection to ${url}...` };

  // Fetch phase
  const startTime = Date.now();
  let html = '';
  let httpStatus = 0;
  let responseHeaders: Record<string, string> = {};

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Lumina-AI-Optimizer/1.0 (AI Readiness Scanner)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
    });

    clearTimeout(timeout);
    httpStatus = response.status;
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });

    html = await response.text();
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : 'Unknown error';
    yield { type: 'log', tag: 'ERROR', message: `Fetch failed: ${errMsg}` };
    yield { type: 'error', message: `Failed to fetch URL: ${errMsg}` };
    return;
  }

  const loadTime = Date.now() - startTime;

  yield { type: 'log', tag: 'FETCH', message: `${url} ... ${httpStatus} OK — ${loadTime}ms` };
  yield { type: 'log', tag: 'FETCH', message: `Response size: ${(html.length / 1024).toFixed(1)}KB | Content-Type: ${responseHeaders['content-type'] || 'unknown'}` };

  // Parse phase
  yield { type: 'log', tag: 'PARSE', message: 'Loading DOM into parser engine...' };
  const $ = cheerio.load(html);

  // Extract title
  const titleTag = $('title').first().text().trim();
  yield { type: 'log', tag: 'PARSE', message: `Title tag: "${titleTag || '(missing)'}"` };

  // Extract canonical
  const canonicalUrl = $('link[rel="canonical"]').attr('href') || '';

  // Extract meta description
  const metaDescription = $('meta[name="description"]').attr('content') || '';
  const hasMetaDescription = metaDescription.length > 0;
  yield { type: 'log', tag: 'META', message: `Meta description: ${hasMetaDescription ? `"${metaDescription.substring(0, 80)}..."` : '(missing)'}` };

  // Extract OpenGraph tags
  yield { type: 'log', tag: 'OG', message: 'Scanning OpenGraph metadata layer...' };
  const openGraphTags: Record<string, string> = {};
  $('meta[property^="og:"]').each((_, el) => {
    const property = $(el).attr('property') || '';
    const content = $(el).attr('content') || '';
    if (property && content) {
      openGraphTags[property] = content;
    }
  });
  $('meta[name^="twitter:"]').each((_, el) => {
    const name = $(el).attr('name') || '';
    const content = $(el).attr('content') || '';
    if (name && content) {
      openGraphTags[name] = content;
    }
  });
  yield { type: 'log', tag: 'OG', message: `Extracted ${Object.keys(openGraphTags).length} OpenGraph/Twitter Card tags` };

  // Extract JSON-LD schemas
  yield { type: 'log', tag: 'SCHEMA', message: 'Scanning structured data (JSON-LD) objects...' };
  const jsonLdSchemas: object[] = [];
  const extractedTags: string[] = [];

  // Collect schemas first (cannot yield inside .each() callback)
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const content = $(el).html() || '';
      const parsed = JSON.parse(content);
      jsonLdSchemas.push(parsed);
      const schemaType = Array.isArray(parsed)
        ? parsed.map((s: { '@type'?: string }) => s['@type'] || 'Unknown').join(', ')
        : (parsed['@type'] || 'Unknown');
      extractedTags.push(`JSON-LD: ${schemaType}`);
    } catch {
      // Skip invalid JSON
    }
  });

  // Yield schema types after the each() loop
  for (const tag of extractedTags) {
    const schemaType = tag.replace('JSON-LD: ', '');
    yield { type: 'log', tag: 'SCHEMA', message: `Found schema: ${schemaType}` };
  }

  if (jsonLdSchemas.length === 0) {
    yield { type: 'log', tag: 'SCHEMA', message: 'WARNING: No structured data schemas detected' };
  } else {
    yield { type: 'log', tag: 'SCHEMA', message: `Total: ${jsonLdSchemas.length} JSON-LD object(s) identified` };
  }

  // Extract semantic headers
  yield { type: 'log', tag: 'SEMANTIC', message: 'Analyzing semantic document structure...' };
  const semanticHeaders: { level: number; text: string }[] = [];
  $('h1, h2, h3, h4, h5, h6').each((_, el) => {
    const level = parseInt(el.tagName.replace('h', ''), 10);
    const text = $(el).text().trim().substring(0, 100);
    if (text) {
      semanticHeaders.push({ level, text });
    }
  });

  const h1Count = semanticHeaders.filter(h => h.level === 1).length;
  yield { type: 'log', tag: 'SEMANTIC', message: `H1: ${h1Count} | H2: ${semanticHeaders.filter(h => h.level === 2).length} | H3: ${semanticHeaders.filter(h => h.level === 3).length} | H4-H6: ${semanticHeaders.filter(h => h.level >= 4).length}` };

  // Analyze images
  yield { type: 'log', tag: 'MULTIMODAL', message: 'Auditing multimodal indexing vectors...' };
  const images = $('img');
  const imageCount = images.length;
  let imagesWithAlt = 0;
  images.each((_, el) => {
    if ($(el).attr('alt')?.trim()) imagesWithAlt++;
  });
  const missingAlt = imageCount - imagesWithAlt;
  yield { type: 'log', tag: 'MULTIMODAL', message: `Images: ${imageCount} total | ${imagesWithAlt} with alt text | ${missingAlt} missing alt (indexing gap)` };

  // Analyze links
  const allLinks = $('a[href]');
  let internalLinks = 0;
  let externalLinks = 0;
  const urlObj = new URL(url);
  allLinks.each((_, el) => {
    const href = $(el).attr('href') || '';
    try {
      const linkUrl = new URL(href, url);
      if (linkUrl.hostname === urlObj.hostname) {
        internalLinks++;
      } else {
        externalLinks++;
      }
    } catch {
      internalLinks++;
    }
  });
  yield { type: 'log', tag: 'LINKS', message: `Link topology: ${internalLinks} internal | ${externalLinks} external` };

  // Tokenization phase
  yield { type: 'log', tag: 'TOKENIZE', message: 'Initiating tokenization phase — measuring semantic entropy...' };

  // Calculate text content
  // Remove scripts, styles, nav, footer for meaningful content analysis
  const $clone = cheerio.load(html);
  $clone('script, style, nav, footer, header, aside, [class*="cookie"], [class*="popup"], [id*="cookie"]').remove();
  const meaningfulText = $clone('body').text().replace(/\s+/g, ' ').trim();

  // Full text from body
  const fullBodyText = $('body').text().replace(/\s+/g, ' ').trim();
  const wordCount = fullBodyText.split(/\s+/).filter(w => w.length > 0).length;

  // Text to HTML ratio
  const textContent = fullBodyText;
  const htmlLength = html.length;
  const textToHtmlRatio = htmlLength > 0 ? (textContent.length / htmlLength) * 100 : 0;

  yield { type: 'log', tag: 'TOKENIZE', message: `Text-to-HTML ratio: ${textToHtmlRatio.toFixed(1)}% | Word count: ${wordCount}` };
  yield { type: 'log', tag: 'TOKENIZE', message: `Meaningful content tokens: ${meaningfulText.split(/\s+/).filter(w => w.length > 0).length} | Context window density: ${Math.min(100, (meaningfulText.length / 4000) * 100).toFixed(1)}%` };

  // Raw text sample
  const rawTextSample = meaningfulText.substring(0, 500);

  // Build raw findings object
  const rawFindings: RawFindings = {
    httpStatus,
    loadTime,
    extractedTags,
    rawTextSample,
    headers: responseHeaders,
    jsonLdSchemas,
    openGraphTags,
    semanticHeaders,
    textToHtmlRatio,
    wordCount,
    imageCount,
    imagesWithAlt,
    internalLinks,
    externalLinks,
    hasMetaDescription,
    metaDescription,
    titleTag,
    canonicalUrl,
  };

  // Scoring phase
  yield { type: 'log', tag: 'SCORE', message: 'Executing scoring formula — calculating AI Readiness Index...' };

  const { score, semanticScore, tokenScore, metadataScore } = calculateScore(rawFindings);

  yield { type: 'log', tag: 'SCORE', message: `Semantic Structure score: ${semanticScore.toFixed(1)}/100` };
  yield { type: 'log', tag: 'SCORE', message: `Token Density score: ${tokenScore.toFixed(1)}/100` };
  yield { type: 'log', tag: 'SCORE', message: `Metadata Accuracy score: ${metadataScore.toFixed(1)}/100` };
  yield { type: 'log', tag: 'SCORE', message: `AI Readiness Index: ${score.toFixed(1)}/100` };

  // Generate recommendations
  yield { type: 'log', tag: 'ROADMAP', message: 'Generating AI optimization roadmap...' };
  const recommendations = generateRecommendations(rawFindings);
  yield { type: 'log', tag: 'ROADMAP', message: `Identified ${recommendations.length} optimization vectors` };

  yield { type: 'log', tag: 'COMPLETE', message: 'Scan complete. AI Readiness report ready.' };

  yield {
    type: 'complete',
    data: {
      score,
      semanticScore,
      tokenScore,
      metadataScore,
      rawFindings,
      recommendations,
    },
  };
}

export function calculateScore(findings: RawFindings): {
  score: number;
  semanticScore: number;
  tokenScore: number;
  metadataScore: number;
} {
  // Semantic Structure Score (weight: 0.4)
  let semanticScore = 0;

  // H1 presence and uniqueness (20 pts)
  const h1Count = findings.semanticHeaders.filter(h => h.level === 1).length;
  if (h1Count === 1) semanticScore += 20;
  else if (h1Count > 1) semanticScore += 10; // Multiple H1s penalized

  // Heading hierarchy (20 pts)
  const hasH2 = findings.semanticHeaders.some(h => h.level === 2);
  const hasH3 = findings.semanticHeaders.some(h => h.level === 3);
  if (hasH2) semanticScore += 12;
  if (hasH3) semanticScore += 8;

  // JSON-LD schemas (30 pts)
  if (findings.jsonLdSchemas.length >= 3) semanticScore += 30;
  else if (findings.jsonLdSchemas.length === 2) semanticScore += 22;
  else if (findings.jsonLdSchemas.length === 1) semanticScore += 12;

  // Canonical URL (15 pts)
  if (findings.canonicalUrl) semanticScore += 15;

  // Title tag (15 pts)
  if (findings.titleTag && findings.titleTag.length >= 20 && findings.titleTag.length <= 70) semanticScore += 15;
  else if (findings.titleTag) semanticScore += 8;

  // Token Density Score (weight: 0.3)
  let tokenScore = 0;

  // Text-to-HTML ratio (40 pts)
  if (findings.textToHtmlRatio >= 25) tokenScore += 40;
  else if (findings.textToHtmlRatio >= 15) tokenScore += 28;
  else if (findings.textToHtmlRatio >= 8) tokenScore += 16;
  else tokenScore += 5;

  // Word count (30 pts) - More content = better for LLM indexing
  if (findings.wordCount >= 1000) tokenScore += 30;
  else if (findings.wordCount >= 500) tokenScore += 22;
  else if (findings.wordCount >= 200) tokenScore += 14;
  else tokenScore += 5;

  // Image alt text coverage (30 pts)
  if (findings.imageCount === 0) {
    tokenScore += 20; // No images, neutral
  } else {
    const altCoverage = findings.imagesWithAlt / findings.imageCount;
    tokenScore += Math.round(altCoverage * 30);
  }

  // Metadata Accuracy Score (weight: 0.3)
  let metadataScore = 0;

  // Meta description (25 pts)
  if (findings.hasMetaDescription) {
    if (findings.metaDescription.length >= 120 && findings.metaDescription.length <= 160) {
      metadataScore += 25;
    } else if (findings.metaDescription.length > 0) {
      metadataScore += 15;
    }
  }

  // OpenGraph tags (35 pts)
  const ogKeys = Object.keys(findings.openGraphTags);
  if (ogKeys.includes('og:title')) metadataScore += 10;
  if (ogKeys.includes('og:description')) metadataScore += 10;
  if (ogKeys.includes('og:image')) metadataScore += 8;
  if (ogKeys.includes('og:type')) metadataScore += 7;

  // Twitter card (20 pts)
  const hasTwitterCard = ogKeys.some(k => k.startsWith('twitter:'));
  if (hasTwitterCard) metadataScore += 20;

  // HTTP status (20 pts)
  if (findings.httpStatus === 200) metadataScore += 20;
  else if (findings.httpStatus >= 200 && findings.httpStatus < 300) metadataScore += 15;

  // Cap all scores at 100
  semanticScore = Math.min(100, semanticScore);
  tokenScore = Math.min(100, tokenScore);
  metadataScore = Math.min(100, metadataScore);

  // Weighted final score
  const Ws = 0.4;
  const Wt = 0.3;
  const Wa = 0.3;
  const totalWeight = Ws + Wt + Wa;
  const score = ((Ws * semanticScore) + (Wt * tokenScore) + (Wa * metadataScore)) / totalWeight;

  return { score, semanticScore, tokenScore, metadataScore };
}

export function generateRecommendations(findings: RawFindings): Recommendation[] {
  const recs: Recommendation[] = [];

  // Check H1
  const h1Count = findings.semanticHeaders.filter(h => h.level === 1).length;
  if (h1Count === 0) {
    recs.push({
      priority: 'critical',
      category: 'Semantic Structure',
      issue: 'Missing H1 tag — primary semantic anchor absent',
      impact: 'LLMs cannot identify the primary topic of the page, causing severe context window degradation',
      fix: 'Add a single, descriptive H1 tag as the primary heading of each page',
    });
  } else if (h1Count > 1) {
    recs.push({
      priority: 'high',
      category: 'Semantic Structure',
      issue: `Multiple H1 tags detected (${h1Count}) — semantic entropy elevated`,
      impact: 'Dilutes topical authority signals and confuses LLM document parsing',
      fix: 'Consolidate to a single H1 per page that captures the primary topic',
    });
  }

  // Check JSON-LD
  if (findings.jsonLdSchemas.length === 0) {
    recs.push({
      priority: 'critical',
      category: 'Structured Data',
      issue: 'No JSON-LD structured data detected',
      impact: 'AI search engines and LLMs cannot extract entity relationships or semantic context',
      fix: 'Implement JSON-LD schemas: Organization, WebPage, BreadcrumbList, and Article/Product as applicable',
    });
  } else if (findings.jsonLdSchemas.length < 3) {
    recs.push({
      priority: 'high',
      category: 'Structured Data',
      issue: `Insufficient schema coverage (${findings.jsonLdSchemas.length} schema(s) detected)`,
      impact: 'Incomplete entity graph reduces AI indexing accuracy and knowledge graph integration',
      fix: 'Expand JSON-LD coverage with BreadcrumbList, FAQPage, and entity-specific schemas',
    });
  }

  // Check images without alt
  const missingAlt = findings.imageCount - findings.imagesWithAlt;
  if (missingAlt > 0) {
    recs.push({
      priority: missingAlt > 5 ? 'high' : 'medium',
      category: 'Multimodal Indexing',
      issue: `Missing alt text on ${missingAlt} image(s) — multimodal indexing gap`,
      impact: 'Prevents multimodal AI models from incorporating visual content into semantic analysis',
      fix: 'Add descriptive alt text to all images, using natural language that provides context for AI models',
    });
  }

  // Check meta description
  if (!findings.hasMetaDescription) {
    recs.push({
      priority: 'high',
      category: 'Metadata Accuracy',
      issue: 'Meta description absent — context window optimization missed',
      impact: 'AI engines default to extracting arbitrary text, reducing indexing latency efficiency',
      fix: 'Add a meta description of 120-160 characters summarizing the page\'s primary value proposition',
    });
  } else if (findings.metaDescription.length < 120 || findings.metaDescription.length > 160) {
    recs.push({
      priority: 'medium',
      category: 'Metadata Accuracy',
      issue: `Meta description length suboptimal (${findings.metaDescription.length} chars)`,
      impact: 'Non-optimal description length reduces context efficiency in AI snippet generation',
      fix: 'Optimize meta description to 120-160 characters for maximum context window utilization',
    });
  }

  // Check OpenGraph
  const ogKeys = Object.keys(findings.openGraphTags);
  if (ogKeys.length === 0) {
    recs.push({
      priority: 'high',
      category: 'Metadata Accuracy',
      issue: 'No OpenGraph metadata detected',
      impact: 'AI-powered social and search platforms cannot extract rich preview data',
      fix: 'Implement og:title, og:description, og:image, and og:type tags',
    });
  }

  // Check Twitter card
  const hasTwitterCard = ogKeys.some(k => k.startsWith('twitter:'));
  if (!hasTwitterCard) {
    recs.push({
      priority: 'low',
      category: 'Metadata Accuracy',
      issue: 'Twitter Card metadata absent',
      impact: 'Reduces AI-driven social sharing optimization opportunities',
      fix: 'Add twitter:card, twitter:title, and twitter:description meta tags',
    });
  }

  // Check canonical
  if (!findings.canonicalUrl) {
    recs.push({
      priority: 'medium',
      category: 'Semantic Structure',
      issue: 'Canonical URL not specified',
      impact: 'AI crawlers may index duplicate content variants, diluting semantic authority',
      fix: 'Add <link rel="canonical"> tag pointing to the authoritative URL',
    });
  }

  // Check text ratio
  if (findings.textToHtmlRatio < 15) {
    recs.push({
      priority: 'medium',
      category: 'Token Density',
      issue: `Low text-to-HTML ratio (${findings.textToHtmlRatio.toFixed(1)}%) — excessive boilerplate noise`,
      impact: 'High ratio of code/boilerplate reduces semantic density available for LLM context windows',
      fix: 'Increase meaningful content, reduce inline scripts/styles, and implement code-splitting',
    });
  }

  // Check word count
  if (findings.wordCount < 300) {
    recs.push({
      priority: 'medium',
      category: 'Token Density',
      issue: `Insufficient content depth (${findings.wordCount} words)`,
      impact: 'Thin content limits AI\'s ability to build semantic context models for this page',
      fix: 'Expand content to 600+ words with structured information addressing user intent',
    });
  }

  // Sort by priority
  const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  recs.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  return recs;
}
