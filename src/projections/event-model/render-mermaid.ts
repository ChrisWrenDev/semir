import { EventModelIR } from "./ir";

function mermaidNodeId(id: string): string {
  return id.replace(/[^a-zA-Z0-9]/g, "_");
}

export function renderMermaid(ir: EventModelIR): string {
  const lines: string[] = ["graph LR"];

  const allNodes = new Map<string, { label: string; shape: "rect" | "stadium" | "diamond" | "circle" }>();

  for (const cmd of ir.commands) {
    allNodes.set(cmd.id, { label: cmd.name, shape: "rect" });
  }
  for (const evt of ir.events) {
    allNodes.set(evt.id, { label: evt.name, shape: "stadium" });
  }
  for (const st of ir.states) {
    allNodes.set(st.id, { label: st.name, shape: "diamond" });
  }

  for (const [id, node] of allNodes) {
    const mId = mermaidNodeId(id);
    switch (node.shape) {
      case "rect":
        lines.push(`    ${mId}["${node.label}"]`);
        break;
      case "stadium":
        lines.push(`    ${mId}(["${node.label}"])`);
        break;
      case "diamond":
        lines.push(`    ${mId}{"${node.label}"}`);
        break;
    }
  }

  lines.push("");

  const edgeStyle: Record<string, string> = {
    causes: "-->",
    transitions_to: "==>",
    requires: "-.->",
    forbids: "-.x",
    authorized_by: "-.->",
    observable_within: "-.->",
  };

  for (const edge of ir.edges) {
    const from = mermaidNodeId(edge.from);
    const to = mermaidNodeId(edge.to);
    const style = edgeStyle[edge.kind] || "-->";
    const label = edge.label || edge.kind;
    lines.push(`    ${from} ${style}|${label}| ${to}`);
  }

  return lines.join("\n");
}
