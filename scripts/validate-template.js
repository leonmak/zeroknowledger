#!/usr/bin/env node

/**
 * TLSNotary Template Validator
 * 
 * Usage:
 *   node scripts/validate-template.js \
 *     --template docs/tlsnotary/templates/stripe-monthly-volume.json \
 *     --fixture docs/tlsnotary/fixtures/income/stripe-monthly-volume/2024-04-us-en.html \
 *     --expected docs/tlsnotary/fixtures/income/stripe-monthly-volume/2024-04-us-en.extraction.json
 */

import fs from "node:fs";
import path from "node:path";
import { JSDOM } from "jsdom";

type TemplateConfig = {
  name: string;
  extract: {
    selector: string;
    pattern: string;
    transform?: string;
  };
  disclose: {
    mode: string;
    value?: number;
    comparison?: string;
  };
  redact: string[];
};

type ExtractionResult = {
  success: boolean;
  matched_text?: string;
  extracted_value?: number | boolean | string;
  error?: string;
};

function parseArgs() {
  const args = process.argv.slice(2);
  const result: Record<string, string> = {};
  for (let i = 0; i < args.length; i += 2) {
    if (args[i].startsWith("--")) {
      result[args[i].slice(2)] = args[i + 1];
    }
  }
  return result;
}

function loadJSON(filePath: string): unknown {
  const content = fs.readFileSync(filePath, "utf8");
  return JSON.parse(content);
}

function validateSelector(html: string, selector: string): Element | null {
  const dom = new JSDOM(html);
  const elements = dom.window.document.querySelectorAll(selector);

  if (elements.length === 0) {
    console.warn(`⚠️  Selector matched 0 elements: ${selector}`);
    return null;
  }

  if (elements.length > 1) {
    console.warn(`⚠️  Selector matched ${elements.length} elements (expected 1)`);
  }

  return elements[0] || null;
}

function extractValue(
  element: Element | null,
  pattern: string,
  transform?: string,
): ExtractionResult {
  if (!element) {
    return { success: false, error: "No element matched by selector" };
  }

  const text = element.textContent || element.getAttribute("value") || "";
  const regex = new RegExp(pattern);
  const match = text.match(regex);

  if (!match) {
    return { success: false, error: `Pattern did not match: ${pattern}` };
  }

  let value: unknown = match[1] || match[0];

  if (transform) {
    try {
      // eslint-disable-next-line no-eval
      value = eval(`(function(match) { return ${transform} })`)(match);
    } catch (err) {
      return {
        success: false,
        error: `Transform failed: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  return {
    success: true,
    matched_text: match[0],
    extracted_value: value,
  };
}

function validateRedaction(
  html: string,
  redactSelectors: string[],
): { removed: number; failed: string[] } {
  const dom = new JSDOM(html);
  let removed = 0;
  const failed: string[] = [];

  for (const selector of redactSelectors) {
    const elements = dom.window.document.querySelectorAll(selector);
    if (elements.length === 0) {
      failed.push(selector);
    } else {
      removed += elements.length;
    }
  }

  return { removed, failed };
}

async function main() {
  const args = parseArgs();

  if (!args.template || !args.fixture) {
    console.error("Usage: node validate-template.js --template <path> --fixture <path> [--expected <path>]");
    process.exit(1);
  }

  console.log(`\n📋 Validating template: ${args.template}\n`);

  // Load template
  const template = loadJSON(args.template) as TemplateConfig;
  console.log(`✓ Template loaded: ${template.name}`);

  // Load fixture HTML
  const html = fs.readFileSync(args.fixture, "utf8");
  console.log(`✓ Fixture loaded: ${args.fixture} (${html.length} bytes)\n`);

  // Test selector
  console.log("🔍 Testing selector...");
  const selector = template.extract.selector.split(",")[0].trim();
  const element = validateSelector(html, selector);
  if (element) {
    console.log(`✓ Selector matched: ${selector}\n`);
  } else {
    console.error(`✗ Selector failed: ${selector}\n`);
    process.exit(1);
  }

  // Test extraction
  console.log("🎯 Testing extraction...");
  const extraction = extractValue(element, template.extract.pattern, template.extract.transform);
  if (extraction.success) {
    console.log(`✓ Pattern matched: "${extraction.matched_text}"`);
    console.log(`✓ Extracted value: ${JSON.stringify(extraction.extracted_value)}\n`);
  } else {
    console.error(`✗ Extraction failed: ${extraction.error}\n`);
    process.exit(1);
  }

  // Test redaction
  console.log("🚫 Testing redaction...");
  const redaction = validateRedaction(html, template.redact);
  console.log(`✓ Redact selectors would remove: ${redaction.removed} elements`);
  if (redaction.failed.length > 0) {
    console.warn(`⚠️  Failed to find ${redaction.failed.length} redact selectors:`);
    redaction.failed.forEach((s) => console.warn(`   - ${s}`));
  }
  console.log("");

  // Compare with expected if provided
  if (args.expected) {
    console.log("📊 Comparing with expected output...");
    const expected = loadJSON(args.expected) as Record<string, unknown>;
    
    if (expected.extracted_value !== extraction.extracted_value) {
      console.error(
        `✗ Value mismatch: expected ${expected.extracted_value}, got ${extraction.extracted_value}`
      );
      process.exit(1);
    }

    console.log(`✓ Extracted value matches expected: ${expected.extracted_value}\n`);
  }

  console.log("✅ All validations passed!\n");
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
