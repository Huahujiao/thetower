const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Run the application with a small DOM/canvas adapter; inspect real pixel data
// and exported files without requiring a browser or third-party dependencies.
function setup() {
  const nodes = new Map(), observers = [], frames = [], files = new Map();
  let overlay;
  const document = { activeElement: null };
  let window;
  function element(tagName = 'DIV') {
    const node = {
      tagName, value: '8', checked: false, className: '', dataset: {}, style: {},
      children: [], events: {}, attributes: {}, disabled: false, open: false,
      clientWidth: 640, clientHeight: 480,
      setAttribute(name, value) { this.attributes[name] = value; },
      addEventListener(type, fn) { (this.events[type] ??= []).push(fn); },
      removeEventListener(type, fn) { this.events[type] = (this.events[type] || []).filter(f => f !== fn); },
      appendChild(child) { child.parent = this; this.children.push(child); },
      querySelector(selector) { return this.querySelectorAll(selector)[0] || null; },
      querySelectorAll(selector) {
        const result = [];
        const id = selector.match(/data-part-id="([^"]+)"/)?.[1];
        function visit(parent) {
          for (const child of parent.children) {
            if (id ? child.dataset.partId === id : child.className.split(' ').includes(selector.slice(1))) result.push(child);
            visit(child);
          }
        }
        visit(this);
        return result;
      },
      dispatch(type, data = {}) {
        const event = { target: this, defaultPrevented: false, stopped: false,
          preventDefault() { this.defaultPrevented = true; }, stopPropagation() { this.stopped = true; }, ...data };
        for (let current = this; current; current = current.parent) {
          for (const fn of current.events[type] || []) fn(event);
          if (event.stopped) return event;
        }
        if (this !== window) for (const fn of window.events[type] || []) fn(event);
        return event;
      },
      click() { if (!this.disabled) this.dispatch('click'); },
      focus() {
        const previous = document.activeElement;
        document.activeElement = this;
        for (const fn of previous?.events.blur || []) fn({});
        for (const fn of this.events.focus || []) fn({});
      },
      scrollIntoView() {}, showModal() { this.open = true; }, close() { this.open = false; },
      getBoundingClientRect() { return { left: 240, top: 300, right: 266, bottom: 326, width: tagName === 'DIALOG' ? 320 : 26, height: tagName === 'DIALOG' ? 360 : 26 }; },
      getContext() {
        return this.context ??= {
          clearRect() {}, save() {}, restore() {}, fillRect() {}, strokeRect() {}, setLineDash() {}, fillText() {},
          measureText() { return { width: 12 }; },
          createImageData(width, height) { return { data: new Uint8ClampedArray(width * height * 4) }; },
          getImageData() { return { data: new Uint8ClampedArray(node.originalImageData || node.imageData?.data || node.width * node.height * 4) }; },
          putImageData(data) { node.imageData = data; },
          drawImage(image) {
            if (image.originalImageData) node.originalImageData = image.originalImageData;
            if (node === nodes.get('previewCanvas') && image.imageData) overlay = [...image.imageData.data];
          }
        };
      },
      toDataURL() { return 'data:image/png;base64,dGVzdA=='; },
      toBlob(callback) { callback({ width: this.width, height: this.height, pixels: [...(this.imageData?.data || [])] }); }
    };
    Object.defineProperty(node, 'innerHTML', { get() { return this.markup; }, set(value) { this.children = []; this.markup = value; } });
    node.classList = {
      contains(value) { return node.className.split(' ').includes(value); },
      toggle(value, force) {
        const classes = new Set(node.className.split(' ').filter(Boolean));
        const add = force ?? !classes.has(value);
        if (add) classes.add(value); else classes.delete(value);
        node.className = [...classes].join(' ');
      },
      add(value) { this.toggle(value, true); }, remove(value) { this.toggle(value, false); }
    };
    return node;
  }
  const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
  for (const [, tag, id, attributes] of html.matchAll(/<([a-z]+)[^>]*?id="([^"]+)"([^>]*)>/g)) {
    const node = element(tag.toUpperCase());
    node.className = attributes.match(/class="([^"]+)"/)?.[1] || '';
    node.disabled = /\bdisabled\b/.test(attributes);
    node.value = attributes.match(/value="([^"]+)"/)?.[1] || '8';
    nodes.set(id, node);
  }
  document.querySelector = selector => nodes.get(selector.slice(1));
  document.createElement = tag => element(tag.toUpperCase());
  nodes.get('stats').querySelectorAll = () => [element(), element(), element()];
  window = element(); window.innerWidth = 1280; window.innerHeight = 800;
  let worker;
  class Worker {
    constructor() { Object.assign(this, element()); worker = this; }
    postMessage() {
      if (this.failure) for (const fn of this.events.error || []) fn({ error: new Error('analysis failed') });
      else for (const fn of [...(this.events.message || [])]) fn({ data: this.result });
    }
  }
  class IntersectionObserver {
    constructor(callback) { this.callback = callback; this.targets = []; observers.push(this); }
    observe(target) { this.targets.push(target); } unobserve() {} disconnect() { this.targets = []; }
    flush() { this.callback(this.targets.map(target => ({ target, isIntersecting: true }))); }
  }
  const context = vm.createContext({ document, window, Worker, IntersectionObserver,
    ResizeObserver: class { observe() {} }, requestAnimationFrame(fn) { frames.push(fn); },
    getComputedStyle() { return { paddingLeft: '18px', paddingRight: '18px', paddingTop: '18px', paddingBottom: '18px' }; },
    console: { error() {} }, alert() {}
  });
  const run = code => vm.runInContext(code, context);
  run(fs.readFileSync(path.join(__dirname, '../app.js'), 'utf8'));
  // Two separated pixels surround a third unrelated component inside the union box.
  const labels = new Int32Array(21); labels[8] = 1; labels[12] = 2; labels[10] = 3;
  const pixels = new Uint8ClampedArray(84);
  for (const index of [8, 10, 12]) pixels.set([index, 50, 90, 255], index * 4);
  const components = [[1, 1], [2, 5], [3, 3]].map(([id, x]) => ({ id, area: 1, minX: x, maxX: x, minY: 1, maxY: 1, width: 1, height: 1 }));
  const asset = { id: 'a', name: 'a.png', width: 7, height: 3, bitmap: { originalImageData: pixels }, file: { type: 'image/png', size: 84 },
    sourceImageData: { data: pixels }, analysis: { labels, components, settings: { padding: 0 }, elapsed: 10 } };
  context.sample = asset;
  run("assets.push(sample);selectedId='a';previewActive=true;sidebarMode='parts';renderPartList();drawSelected();");
  nodes.get('analyzeBtn').disabled = false;
  const selected = () => run('selectedPartId');
  const merge = (source, target) => run(`mergeParts(${source},${target})`);
  const undo = () => nodes.get('undoMergeBtn').click();
  function directory(prefix = '') {
    return {
      async getDirectoryHandle(name) { return directory(prefix + name + '/'); },
      async getFileHandle(name) { return { async createWritable() { return { async write(value) { files.set(prefix + name, value); }, async close() {} }; } }; }
    };
  }
  context.testOutputDir = directory(); run('outputDir=testOutputDir');
  return { nodes, asset, run, selected, merge, undo, worker, frames, files, observers, document,
    overlay: () => overlay, ids: () => Array.from(asset.analysis.components, c => c.id),
    row: id => nodes.get('partList').querySelector(`[data-part-id="${id}"]`),
    key: (key, node = nodes.get('partList')) => node.dispatch('keydown', { key }) };
}

test('merge preserves target ID, updates union bounds/count, and keeps original image untouched', () => {
  const h = setup(), original = [...h.asset.sourceImageData.data];
  h.merge(1, 2);
  assert.deepEqual(h.ids(), [2, 3]);
  const merged = h.asset.analysis.components[0];
  assert.deepEqual([merged.id, merged.minX, merged.maxX, merged.width, merged.height, merged.area], [2, 1, 5, 5, 1, 2]);
  assert.equal(h.asset.analysis.labels[8], 2); assert.equal(h.asset.analysis.labels[10], 3);
  assert.equal(h.selected(), 2); assert.equal(h.nodes.get('partCount').textContent, 2);
  assert.ok(!h.nodes.get('manualMergeHint').classList.contains('hidden'));
  assert.deepEqual([...h.asset.sourceImageData.data], original);
});

test('multiple merges undo in reverse order, restoring IDs, order, bounds, pixels and selection', () => {
  const h = setup(), baseline = JSON.stringify(h.asset.analysis.components), labels = [...h.asset.analysis.labels];
  h.merge(1, 2); h.merge(2, 3);
  assert.deepEqual(h.ids(), [3]);
  assert.equal(h.row(3).children[0].disabled, true);
  h.undo(); assert.deepEqual(h.ids(), [2, 3]); assert.equal(h.selected(), 2);
  h.undo(); assert.equal(JSON.stringify(h.asset.analysis.components), baseline);
  assert.deepEqual([...h.asset.analysis.labels], labels); assert.equal(h.selected(), null);
  assert.equal(h.nodes.get('undoMergeBtn').disabled, true);
  assert.ok(h.nodes.get('manualMergeHint').classList.contains('hidden'));
});

test('export includes both disconnected regions, preserving gaps and excluding unrelated interior pixels', async () => {
  const h = setup(); h.merge(1, 2);
  await h.run('exportAsset(sample)');
  const png = h.files.get('a/parts/part_002.png');
  assert.deepEqual([png.width, png.height], [5, 1]);
  assert.deepEqual([png.pixels[3], png.pixels[7], png.pixels[11], png.pixels[15], png.pixels[19]], [255, 0, 0, 0, 255]);
  const manifest = JSON.parse(h.files.get('a/manifest.json'));
  assert.equal(manifest.parts.length, 2); assert.equal(manifest.parts[0].id, 2);
  assert.deepEqual(manifest.parts[0].exportBounds, { x: 1, y: 1, width: 5, height: 1 });
  assert.ok(!h.files.has('a/parts/part_001.png'));
  h.undo(); await h.run('exportAsset(sample)');
  assert.equal(JSON.parse(h.files.get('a/manifest.json')).parts.length, 3);
});

test('merge icon does not toggle selection; target search, lazy thumbnails and two-part hover work', () => {
  const h = setup(); h.run('selectPart(3)');
  h.row(1).children[0].click();
  assert.equal(h.selected(), 3); assert.equal(h.nodes.get('mergeDialog').open, true);
  assert.deepEqual(h.nodes.get('mergeTargetList').children.map(c => c.dataset.partId), ['2', '3']);
  assert.match(h.nodes.get('mergeTitle').textContent, /#01/);
  h.observers.at(-1).flush();
  assert.ok(h.nodes.get('mergeTargetList').children[0].children[0].src.startsWith('data:image/png'));
  h.nodes.get('mergeTargetList').children[0].dispatch('mouseenter');
  const overlay = h.overlay();
  assert.deepEqual(overlay.slice(8 * 4, 8 * 4 + 3), [255, 180, 84]);
  assert.deepEqual(overlay.slice(12 * 4, 12 * 4 + 3), [86, 173, 255]);
  assert.deepEqual(overlay.slice(10 * 4, 10 * 4 + 3), [0, 0, 0]);
  const search = h.nodes.get('mergeSearch'); search.value = '#02'; search.dispatch('input');
  assert.deepEqual(h.nodes.get('mergeTargetList').children.map(c => c.dataset.partId), ['2']);
  search.value = '999'; search.dispatch('input');
  assert.equal(h.nodes.get('mergeTargetList').children.length, 0);
  assert.match(h.nodes.get('mergeTargetList').innerHTML, /\u6ca1\u6709\u5339\u914d/);
  h.nodes.get('closeMergeBtn').click();
  assert.equal(h.selected(), 3); assert.equal(h.run('mergeSourceId'), null);
});

test('keyboard navigates dialog targets without changing part selection; choosing a target closes and merges', () => {
  const h = setup(); h.row(1).children[0].click();
  h.key('ArrowDown', h.nodes.get('mergeDialog'));
  assert.equal(h.document.activeElement.dataset.partId, '2'); assert.equal(h.selected(), null);
  h.key('ArrowDown', h.nodes.get('mergeDialog'));
  assert.equal(h.document.activeElement.dataset.partId, '3'); assert.equal(h.selected(), null);
  h.document.activeElement.click();
  assert.deepEqual(h.ids(), [2, 3]); assert.equal(h.selected(), 3);
  assert.equal(h.nodes.get('mergeDialog').open, false);
  assert.equal(h.document.activeElement, h.nodes.get('partList'));
});

test('list arrow navigation stays one step and repeated clicks restore all highlights after merging', () => {
  const h = setup(); h.key('ArrowDown'); assert.equal(h.selected(), 1);
  h.key('ArrowDown'); assert.equal(h.selected(), 2);
  h.key('ArrowUp'); assert.equal(h.selected(), 1);
  h.merge(1, 2); h.row(2).click(); assert.equal(h.selected(), null);
  const overlay = h.overlay();
  assert.deepEqual(overlay.slice(8 * 4, 8 * 4 + 3), [74, 129, 184]);
  assert.deepEqual(overlay.slice(12 * 4, 12 * 4 + 3), [74, 129, 184]);
  h.key('ArrowUp'); assert.equal(h.selected(), 3);
});

test('successful reanalysis resets merges, undo history, thumbnail cache and reset hint', async () => {
  const h = setup();
  const result = { labelsBuffer: h.asset.analysis.labels.slice().buffer, components: h.asset.analysis.components.map(c => ({ ...c })), elapsed: 12 };
  h.merge(1, 2); h.worker.result = result;
  h.nodes.get('analyzeBtn').click();
  assert.equal(h.asset.analyzing, true); assert.equal(h.nodes.get('undoMergeBtn').disabled, true);
  await h.frames.shift()();
  assert.deepEqual(h.ids(), [1, 2, 3]); assert.equal(h.asset.mergeHistory.length, 0);
  assert.equal(h.asset.analyzing, false); assert.equal(h.asset.partThumbs.size, 0);
  assert.ok(h.nodes.get('manualMergeHint').classList.contains('hidden'));
});

test('failed reanalysis leaves prior merges reversible and restores controls', async () => {
  const h = setup(); h.merge(1, 2); h.worker.failure = true;
  h.nodes.get('analyzeBtn').click(); await h.frames.shift()();
  assert.deepEqual(h.ids(), [2, 3]); assert.equal(h.asset.mergeHistory.length, 1);
  assert.equal(h.nodes.get('undoMergeBtn').disabled, false);
  h.undo(); assert.deepEqual(h.ids(), [1, 2, 3]);
});

test('merge records are retained per asset and after leaving preview; cancel closes popup', () => {
  const h = setup(); h.merge(1, 2);
  h.run("assets.push({...sample,id:'b',name:'b.png',analysis:null,mergeHistory:[],mergeMessage:''});selectAsset('b');");
  assert.equal(h.nodes.get('undoMergeBtn').disabled, true);
  h.run("selectAsset('a');setPreviewUi(true);");
  assert.deepEqual(h.ids(), [2, 3]); assert.equal(h.nodes.get('undoMergeBtn').disabled, false);
  h.row(2).children[0].click(); h.nodes.get('mergeDialog').dispatch('cancel');
  assert.equal(h.nodes.get('mergeDialog').open, false); assert.equal(h.selected(), null);
  h.undo(); assert.deepEqual(h.ids(), [1, 2, 3]);
});
