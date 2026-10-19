/**
 * A small XML reader for ENTSO-E documents: elements, attributes, text and
 * the five predefined entities. No DOM, no namespaces beyond dropping the
 * prefix, no DTDs or processing instructions kept. It is enough for the
 * MarketDocument schemas and runs the same on Bun and in a Worker.
 */
export interface XmlNode {
  name: string;
  attrs: Record<string, string>;
  children: XmlNode[];
  text: string;
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

function decode(s: string): string {
  return s.replace(/&(#x[0-9a-fA-F]+|#\d+|[a-z]+);/g, (m, e: string) => {
    if (e.startsWith("#x")) return String.fromCodePoint(Number.parseInt(e.slice(2), 16));
    if (e.startsWith("#")) return String.fromCodePoint(Number(e.slice(1)));
    return ENTITIES[e] ?? m;
  });
}

function localName(qname: string): string {
  const i = qname.indexOf(":");
  return i === -1 ? qname : qname.slice(i + 1);
}

function parseAttrs(s: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const re = /([^\s=]+)\s*=\s*("([^"]*)"|'([^']*)')/g;
  let m: RegExpExecArray | null = re.exec(s);
  while (m) {
    const name = localName(m[1] ?? "");
    if (name !== "xmlns" && !(m[1] ?? "").startsWith("xmlns:")) attrs[name] = decode(m[3] ?? m[4] ?? "");
    m = re.exec(s);
  }
  return attrs;
}

/** Parse a document and return its root element. Throws on unbalanced tags. */
export function readXml(text: string): XmlNode {
  const root: XmlNode = { name: "", attrs: {}, children: [], text: "" };
  const stack: XmlNode[] = [root];
  const tag =
    /<!\[CDATA\[([\s\S]*?)\]\]>|<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<!DOCTYPE[^>]*>|<\/([^\s>]+)\s*>|<([^\s/>]+)([^>]*?)(\/?)>|([^<]+)/g;
  let m: RegExpExecArray | null = tag.exec(text);
  while (m) {
    const top = stack[stack.length - 1] as XmlNode;
    if (m[1] !== undefined) top.text += m[1];
    else if (m[2] !== undefined) {
      if (stack.length < 2 || top.name !== localName(m[2])) throw new Error(`Unbalanced XML: unexpected </${m[2]}>`);
      stack.pop();
    } else if (m[3] !== undefined) {
      const node: XmlNode = { name: localName(m[3]), attrs: parseAttrs(m[4] ?? ""), children: [], text: "" };
      top.children.push(node);
      if (m[5] !== "/") stack.push(node);
    } else if (m[6] !== undefined) {
      const t = m[6];
      if (t.trim()) top.text += decode(t.trim());
    }
    m = tag.exec(text);
  }
  if (stack.length !== 1) throw new Error(`Unbalanced XML: <${(stack[stack.length - 1] as XmlNode).name}> never closed`);
  const first = root.children[0];
  if (!first) throw new Error("Empty XML document");
  return first;
}

export function child(node: XmlNode, name: string): XmlNode | undefined {
  return node.children.find((c) => c.name === name);
}

export function children(node: XmlNode, name: string): XmlNode[] {
  return node.children.filter((c) => c.name === name);
}

export function textOf(node: XmlNode, name: string): string | undefined {
  return child(node, name)?.text;
}
