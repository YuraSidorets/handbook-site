// Self-hosted, pinned Mermaid; no third-party CDN requests.
import mermaid from './vendor/mermaid/mermaid.esm.min.mjs';

function addDiagramAccess(node, index) {
  const svg = node.querySelector('svg');
  if (!svg || svg.getAttribute('aria-roledescription') === 'error' || node.dataset.diagramAccess) return;
  const bounds = (svg.getAttribute('viewBox') || '').trim().split(/[ ,]+/).map(Number);
  if (bounds.length !== 4 || !bounds.every(Number.isFinite) || bounds[2] <= 0 || bounds[3] <= 0) return;
  let heading = node.previousElementSibling;
  while (heading && !heading.matches('h2, h3, h4')) heading = heading.previousElementSibling;
  const titleNode = heading?.cloneNode(true);
  titleNode?.querySelectorAll('.headerlink').forEach(link => link.remove());
  const title = titleNode?.textContent.trim() || `Diagram ${index + 1}`;
  const full = svg.cloneNode(true);
  // Let XMLSerializer emit namespaces from the DOM; HTML label elements
  // may carry redundant xmlns attributes after Mermaid's HTML insertion.
  full.removeAttribute('xmlns');
  full.querySelectorAll('[xmlns]').forEach(element => element.removeAttribute('xmlns'));
  full.setAttribute('width', String(Math.ceil(bounds[2])));
  full.setAttribute('height', String(Math.ceil(bounds[3])));
  full.setAttribute('role', 'img');
  full.setAttribute('aria-label', title);
  full.style.width = `${Math.ceil(bounds[2])}px`;
  full.style.height = `${Math.ceil(bounds[3])}px`;
  full.style.maxWidth = 'none';
  full.style.backgroundColor = 'white';
  full.style.fontFamily = getComputedStyle(svg).fontFamily;
  const caption = document.createElementNS('http://www.w3.org/2000/svg', 'title');
  caption.textContent = title;
  full.prepend(caption);
  const xml = new XMLSerializer().serializeToString(full);
  // Keep URLs alive while their links are available. The browser releases
  // document-owned object URLs when the document is unloaded.
  const url = URL.createObjectURL(new Blob([xml], { type: 'image/svg+xml;charset=utf-8' }));
  const controls = document.createElement('p');
  controls.setAttribute('role', 'group');
  controls.setAttribute('aria-label', `${title} actions`);
  controls.style.cssText = 'display:flex;flex-wrap:wrap;gap:.75rem;margin:.5rem 0 1.5rem';
  const open = document.createElement('a');
  open.href = url;
  open.target = '_blank';
  open.rel = 'noopener noreferrer';
  open.textContent = 'Open full-size diagram (new tab)';
  open.setAttribute('aria-label', `Open ${title} at full size (new tab)`);
  const download = document.createElement('a');
  download.href = url;
  download.download = `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'diagram'}.svg`;
  download.textContent = 'Download SVG';
  download.setAttribute('aria-label', `Download ${title} as SVG`);
  for (const link of [open, download]) link.style.cssText = 'display:inline-flex;align-items:center;min-height:44px;padding:.5rem .75rem;border:1px solid currentColor;border-radius:.25rem';
  controls.append(open, download);
  node.after(controls);
  node.dataset.diagramAccess = 'true';
}

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
  try {
    await mermaid.run({ nodes });
    nodes.forEach(addDiagramAccess);
  }
  catch (error) { console.error('Diagram rendering failed.', error); }
}
