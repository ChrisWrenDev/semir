import { readFileSync, readdirSync } from "fs";
import { join } from "path";
import { ImplementationFact, ExtractedEvidence } from "./evidence.ts";

function extractFactsFromFile(filePath: string): ImplementationFact[] {
  const content = readFileSync(filePath, "utf8");
  const lines = content.split("\n");
  const facts: ImplementationFact[] = [];
  const sourceFile = filePath;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    // State writes: .state = "value" or .status = "value"
    const stateWriteMatch = line.match(/\.(\w+)\s*=\s*["'](\w+)["']/);
    if (stateWriteMatch) {
      facts.push({
        kind: "state_write",
        source: sourceFile,
        line: lineNum,
        detail: `${stateWriteMatch[1]} = ${stateWriteMatch[2]}`,
        symbols: [stateWriteMatch[1], stateWriteMatch[2]],
      });
    }

    // State reads: .state === "value" or .status !== "value"
    const stateReadMatch = line.match(/\.(\w+)\s*(!==?|===?)\s*["'](\w+)["']/);
    if (stateReadMatch) {
      facts.push({
        kind: "guard_check",
        source: sourceFile,
        line: lineNum,
        detail: `${stateReadMatch[1]} ${stateReadMatch[2]} ${stateReadMatch[3]}`,
        symbols: [stateReadMatch[1], stateReadMatch[3]],
      });
    }

    // Equality checks: a === b or a !== b (non-literal)
    const eqMatch = line.match(/(\w+(?:\.\w+)?)\s*(===?|!==?)\s*(\w+(?:\.\w+)?)/);
    if (eqMatch && !eqMatch[1].includes('"') && !eqMatch[3].includes('"')) {
      facts.push({
        kind: "equality_check",
        source: sourceFile,
        line: lineNum,
        detail: `${eqMatch[1]} ${eqMatch[2]} ${eqMatch[3]}`,
        symbols: [eqMatch[1], eqMatch[3]],
      });
    }

    // Function/method definitions
    const funcMatch = line.match(/(?:function|(\w+)\s*\()\s*(\w+)\s*\(/);
    if (funcMatch) {
      const name = funcMatch[2];
      facts.push({
        kind: "function_call",
        source: sourceFile,
        line: lineNum,
        detail: `function ${name}`,
        symbols: [name],
      });
    }

    // Class method definitions: methodName(
    const methodMatch = line.match(/^\s*(\w+)\s*\([^)]*\)\s*[:{]/);
    if (methodMatch && !line.includes("if") && !line.includes("for") && !line.includes("while")) {
      const name = methodMatch[1];
      if (!["constructor", "if", "else", "for", "while", "switch", "catch", "return"].includes(name)) {
        facts.push({
          kind: "function_call",
          source: sourceFile,
          line: lineNum,
          detail: `method ${name}`,
          symbols: [name],
        });
      }
    }

    // Return values with state
    const returnMatch = line.match(/return\s*\{[^}]*reason:\s*["'](\w+)["']/);
    if (returnMatch) {
      facts.push({
        kind: "return_value",
        source: sourceFile,
        line: lineNum,
        detail: `returns reason: ${returnMatch[1]}`,
        symbols: [returnMatch[1]],
      });
    }
  }

  // Test file patterns
  if (filePath.includes("test") || filePath.includes("Test") || filePath.includes(".test.")) {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // test names: it("description") or it('description')
      const testNameMatch = line.match(/it\(["']([^"']+)["']/);
      if (testNameMatch) {
        facts.push({
          kind: "test_name",
          source: sourceFile,
          line: i + 1,
          detail: testNameMatch[1],
          symbols: [testNameMatch[1]],
        });
      }

      // assertions: expect(...).toBe(...), expect(...).toBeFalsy(), etc.
      const assertMatch = line.match(/expect\(([^)]+)\)\.\w+\(/);
      if (assertMatch) {
        facts.push({
          kind: "test_assertion",
          source: sourceFile,
          line: i + 1,
          detail: `asserts ${assertMatch[1]}`,
          symbols: [assertMatch[1]],
        });
      }
    }
  }

  return facts;
}

export function extractEvidence(dir: string): ExtractedEvidence[] {
  const results: ExtractedEvidence[] = [];

  function scan(d: string) {
    try {
      const entries = readdirSync(d, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = join(d, entry.name);
        if (entry.isDirectory()) {
          scan(fullPath);
        } else if (entry.name.endsWith(".ts") || entry.name.endsWith(".js")) {
          const facts = extractFactsFromFile(fullPath);
          if (facts.length > 0) {
            results.push({ facts, sourceFile: fullPath });
          }
        }
      }
    } catch {}
  }

  scan(dir);
  return results;
}
