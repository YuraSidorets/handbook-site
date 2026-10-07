// Self-hosted, pinned Mermaid; no third-party CDN requests.
import mermaid from './vendor/mermaid/mermaid.esm.min.mjs';
const nodes = document.querySelectorAll('.handbook-mermaid');
if (nodes.length) {
  // SuperFences emits <pre><code>source</code></pre>. Mermaid reads the
  // selected element's innerHTML, so remove only the presentation wrapper.
  // A text node preserves the decoded source while safely escaping HTML.
  for (const node of nodes) {
    const code = node.querySelector(':scope > code');
    if (code) node.replaceChildren(document.createTextNode(code.textContent));
  }
  mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: 'default' });
  try { await mermaid.run({ nodes }); }
  catch (error) { console.error('Diagram rendering failed.', error); }
}
