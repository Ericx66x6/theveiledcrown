import { bindAtlas, atlasAction } from './atlas.js';
import { $, esc, icon, button, field, area, select, modal, toast, empty } from '../shared/ui.js';
import { api } from './api.js';
import { readImage } from './media.js';
const cameras = new Map();
let activeCanvas;
const editable = (item, ctx) => !ctx.admin() && item.character_id === ctx.player()?.id;
export { mapPage } from './atlas.js';
export function networkPage(ctx) {
  if (ctx.admin() || !ctx.player())
    return empty('Mural pessoal do personagem.', 'Escolha um personagem no seu acesso de jogador.');
  const net = ctx.state.campaign.network;
  return `<div class="page-intro"><span class="eyebrow">CÍRCULOS DE RELACIONAMENTO</span><h1>Nenhuma história vive sozinha.</h1><p>O mural pessoal de ${esc(ctx.player().char)}. Só o jogador responsável pode abrir e alterar estas relações.</p></div><div class="canvas-toolbar">${button(icon('plus') + ' Adicionar NPC', 'network-add', '', 'button primary')}${button(icon('network') + ' Ligar personagens', 'network-link', net.nodes.length < 2 ? 'disabled' : '', 'button ghost')}<div class="canvas-zoom">${button('−', 'canvas-zoom-out', 'aria-label="Diminuir zoom"', 'icon-button')}${button('Enquadrar', 'canvas-fit', '', 'button ghost')}${button('+', 'canvas-zoom-in', 'aria-label="Aumentar zoom"', 'icon-button')}</div></div><section class="world-canvas network-canvas" id="world-canvas" aria-label="Mural interativo de NPCs"><div class="canvas-grid"></div><div class="canvas-stage" id="canvas-stage" style="width:1400px;height:900px"><svg class="network-lines" id="network-lines" width="1400" height="900" aria-label="Relações entre NPCs"></svg>${net.nodes.map((n) => `<button type="button" class="npc-card" data-node="${n.id}" style="left:${n.x * 1400}px;top:${n.y * 900}px" aria-label="Abrir ${esc(n.name)}"><span class="npc-pin"></span><div class="npc-photo">${n.image ? `<img src="${esc(n.image)}" alt="${esc(n.name)}" draggable="false">` : `<span>${esc(n.name.slice(0, 1))}</span>`}</div><div class="npc-card-caption"><strong>${esc(n.name)}</strong><span>${esc(n.role || n.faction || 'Identidade a descobrir')}</span></div><span class="npc-footer">MURAL DESTE PERSONAGEM</span></button>`).join('')}</div>${!net.nodes.length ? `<div class="canvas-empty"><span>${icon('network')}</span><h2>Comece com um nome.</h2><p>Adicione os NPCs que cruzaram seu caminho. As conexões vêm a seguir.</p>${button('Criar primeiro NPC', 'network-add', '', 'button ghost')}</div>` : ''}<div class="canvas-help">Arraste os cartões para organizar · toque para ler o dossiê · clique nas ligações</div></section><div class="network-directory">${net.nodes.map((n) => button(esc(n.name), 'network-detail', `data-id="${n.id}"`, 'button ghost')).join('')}</div>`;
}
function npcDialog(ctx, n) {
  if (n && !editable(n, ctx)) {
    modal(
      n.name,
      `${n.image ? `<img class="npc-detail-image" src="${esc(n.image)}" alt="${esc(n.name)}">` : ''}<span class="tag">${esc(n.role || n.faction)}</span><h3>O que sabemos</h3><p class="prose modal-description">${esc(n.description)}</p><h3>Impressões e teorias</h3><p class="prose modal-description">${esc(n.theories)}</p>`,
      null,
      { wide: true }
    );
    return;
  }
  modal(
    n ? 'Dossiê · ' + n.name : 'Um rosto no tabuleiro',
    `<div class="form-grid">${field('name', 'Nome do NPC', n?.name || '', 'text', 'required maxlength="150"')}${field('role', 'Ocupação ou papel', n?.role || '', 'text', 'maxlength="500"')}${field('faction', 'Clã, facção ou organização', n?.faction || '', 'text', 'maxlength="500"')}<label class="field full"><span>Retrato do NPC</span><input type="file" name="image" accept="image/png,image/jpeg,image/webp"></label>${area('description', 'O que sabemos sobre ele?', n?.description || '', 'maxlength="30000"')}${area('theories', 'Impressões, suspeitas e teorias', n?.theories || '', 'maxlength="30000"')}</div>${n ? button('Remover NPC e suas ligações', 'network-remove', `data-id="${n.id}"`, 'text-button danger') : ''}`,
    async (form) => {
      const values = Object.fromEntries(form);
      delete values.image;
      const file = form.get('image');
      if (file?.size) values.image = (await readImage(file)).image;
      const count = ctx.state.campaign.network.nodes.length,
        angle = count * 2.4;
      Object.assign(values, {
        x: n?.x ?? 0.5 + Math.cos(angle) * 0.25,
        y: n?.y ?? 0.5 + Math.sin(angle) * 0.25,
        character_id: ctx.player().id,
        revision: n?._revision
      });
      await api('/api/network/nodes' + (n ? '/' + n.id : ''), {
        method: n ? 'PATCH' : 'POST',
        data: values
      });
      await ctx.refresh();
      toast('NPC registrado no mural.');
    },
    { wide: true }
  );
}
function edgeDialog(ctx, e) {
  const options = ctx.state.campaign.network.nodes.map((n) => ({ value: n.id, label: n.name }));
  if (e && !editable(e, ctx)) {
    modal(
      e.label,
      `<p class="prose">${esc(e.description)}</p><p class="hint">${esc(e.attitude)}</p>`,
      null
    );
    return;
  }
  modal(
    e ? 'Editar vínculo' : 'Conectar duas histórias',
    `<div class="form-grid">${select('from', 'De', options, e?.from)}${select('to', 'Para', options, e?.to || options[1]?.value)}${field('label', 'Qual é a relação?', e?.label || '', 'text', 'required maxlength="500" placeholder="Aliados? Rivais? Deve um favor?"')}${field('attitude', 'Como percebemos essa relação?', e?.attitude || '', 'text', 'maxlength="500"')}${area('description', 'Detalhes, suspeitas e evidências', e?.description || '', 'maxlength="30000"')}</div>${e ? button('Remover ligação', 'network-unlink', `data-id="${e.id}"`, 'text-button danger') : ''}`,
    async (form) => {
      await api('/api/network/links' + (e ? '/' + e.id : ''), {
        method: e ? 'PATCH' : 'POST',
        data: { ...Object.fromEntries(form), character_id: ctx.player().id, revision: e?._revision }
      });
      await ctx.refresh();
    },
    { wide: true }
  );
}
class CampaignCanvas {
  constructor(ctx) {
    this.ctx = ctx;
    this.viewport = $('#world-canvas');
    this.stage = $('#canvas-stage');
    this.kind = ctx.state.view;
    this.scene = { width: 1400, height: 900 };
    this.key = ctx.state.campaign.id + 'network' + (ctx.player()?.id || '');
    this.controller = new AbortController();
    this.pointers = new Map();
    this.adding = false;
    if (!this.viewport || !this.stage) return;
    const previous = cameras.get(this.key);
    if (previous && previous.width === this.scene.width) {
      Object.assign(this, previous);
    } else this.fit();
    this.bind();
    this.update();
  }
  fit() {
    const r = this.viewport.getBoundingClientRect();
    let left = 0,
      top = 0,
      width = this.scene.width,
      height = this.scene.height;
    if (this.kind === 'network' && this.ctx.state.campaign.network.nodes.length) {
      const nodes = this.ctx.state.campaign.network.nodes,
        xs = nodes.map((n) => n.x * 1400),
        ys = nodes.map((n) => n.y * 900);
      left = Math.min(...xs) - 120;
      top = Math.min(...ys) - 170;
      width = Math.max(...xs) + 120 - left;
      height = Math.max(...ys) + 170 - top;
    }
    this.scale = Math.min(r.width / width, r.height / height) * 0.88;
    this.x = r.width / 2 - (left + width / 2) * this.scale;
    this.y = r.height / 2 - (top + height / 2) * this.scale;
    this.update();
  }
  update() {
    if (!this.stage) return;
    this.stage.style.transform = `translate(${this.x}px,${this.y}px) scale(${this.scale})`;
    this.stage.style.setProperty('--inverse-scale', 1 / this.scale);
    cameras.set(this.key, { x: this.x, y: this.y, scale: this.scale, width: this.scene.width });
    if (this.kind === 'network') this.edges();
  }
  zoom(factor, point) {
    const r = this.viewport.getBoundingClientRect(),
      cx = point?.x ?? r.width / 2,
      cy = point?.y ?? r.height / 2,
      previous = this.scale;
    this.scale = Math.max(0.015, Math.min(4, this.scale * factor));
    this.x = cx - ((cx - this.x) * this.scale) / previous;
    this.y = cy - ((cy - this.y) * this.scale) / previous;
    this.update();
  }
  position(event) {
    const r = this.viewport.getBoundingClientRect();
    return { x: event.clientX - r.left, y: event.clientY - r.top };
  }
  world(point) {
    return {
      x: Math.max(0, Math.min(1, (point.x - this.x) / this.scale / this.scene.width)),
      y: Math.max(0, Math.min(1, (point.y - this.y) / this.scale / this.scene.height))
    };
  }
  edges() {
    const svg = $('#network-lines');
    if (!svg) return;
    const net = this.ctx.state.campaign.network;
    svg.innerHTML = net.links
      .map((e) => {
        const a = net.nodes.find((n) => n.id === e.from),
          b = net.nodes.find((n) => n.id === e.to);
        if (!a || !b) return '';
        const x1 = a.x * 1400,
          y1 = a.y * 900,
          x2 = b.x * 1400,
          y2 = b.y * 900;
        return `<g data-edge="${e.id}" class="network-edge"><path d="M${x1},${y1} Q${(x1 + x2) / 2},${(y1 + y2) / 2 - 70} ${x2},${y2}" fill="none" stroke="#e64c70" stroke-width="2" vector-effect="non-scaling-stroke"/><path d="M${x1},${y1} Q${(x1 + x2) / 2},${(y1 + y2) / 2 - 70} ${x2},${y2}" fill="none" stroke="transparent" stroke-width="18" vector-effect="non-scaling-stroke"/><text x="${(x1 + x2) / 2}" y="${(y1 + y2) / 2 - 40}" text-anchor="middle" font-size="${12 / this.scale}" fill="#f5cad7" paint-order="stroke" stroke="#180d16" stroke-width="${4 / this.scale}">${esc(e.label)}</text></g>`;
      })
      .join('');
  }
  bind() {
    const opts = { signal: this.controller.signal };
    this.viewport.addEventListener(
      'wheel',
      (event) => {
        event.preventDefault();
        this.zoom(event.deltaY < 0 ? 1.15 : 1 / 1.15, this.position(event));
      },
      { ...opts, passive: false }
    );
    this.viewport.addEventListener(
      'pointerdown',
      (event) => {
        if (event.button && event.button !== 0) return;
        const point = this.position(event);
        this.pointers.set(event.pointerId, point);
        this.viewport.setPointerCapture(event.pointerId);
        const node = event.target.closest('[data-node]'),
          edge = event.target.closest('[data-edge]');
        this.target = node
          ? { kind: 'node', id: node.dataset.node }
          : edge
            ? { kind: 'edge', id: edge.dataset.edge }
            : null;
        const item =
          this.target?.kind === 'node'
            ? this.ctx.state.campaign.network.nodes.find((n) => n.id === this.target.id)
            : null;
        this.drag = {
          start: point,
          last: point,
          distance: 0,
          item: item && editable(item, this.ctx) ? item : null,
          original: item ? { x: item.x, y: item.y } : null
        };
        this.viewport.classList.add('dragging');
        if (this.pointers.size === 2) {
          const [a, b] = [...this.pointers.values()];
          this.pinch = {
            distance: Math.hypot(a.x - b.x, a.y - b.y),
            center: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
          };
        }
      },
      opts
    );
    this.viewport.addEventListener(
      'pointermove',
      (event) => {
        if (!this.pointers.has(event.pointerId)) return;
        const point = this.position(event);
        this.pointers.set(event.pointerId, point);
        if (this.pointers.size === 2) {
          const [a, b] = [...this.pointers.values()],
            distance = Math.hypot(a.x - b.x, a.y - b.y),
            center = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
          if (this.pinch) {
            this.zoom(distance / this.pinch.distance, center);
            this.x += center.x - this.pinch.center.x;
            this.y += center.y - this.pinch.center.y;
            this.update();
          }
          this.pinch = { distance, center };
          this.drag.distance = 100;
          return;
        }
        if (!this.drag) return;
        this.drag.distance = Math.hypot(point.x - this.drag.start.x, point.y - this.drag.start.y);
        if (this.drag.item && this.drag.distance > 5) {
          const pos = this.world(point);
          Object.assign(this.drag.item, pos);
          const node = this.stage.querySelector(`[data-node="${this.target.id}"]`);
          node.style.left = pos.x * this.scene.width + 'px';
          node.style.top = pos.y * this.scene.height + 'px';
          this.edges();
        } else if (!this.adding && !this.drag.item) {
          this.x += point.x - this.drag.last.x;
          this.y += point.y - this.drag.last.y;
          this.update();
        }
        this.drag.last = point;
      },
      opts
    );
    const end = async (event) => {
      if (!this.pointers.has(event.pointerId)) return;
      this.pointers.delete(event.pointerId);
      if (this.pointers.size) {
        this.pinch = null;
        return;
      }
      this.viewport.classList.remove('dragging');
      const drag = this.drag,
        target = this.target;
      this.drag = null;
      this.pinch = null;
      if (!drag) return;
      if (drag.distance > 5 && drag.item) {
        const item = drag.item;
        await this.ctx.safe(async () => {
          try {
            await api(`/api/network/nodes/${item.id}`, {
              method: 'PATCH',
              data: {
                x: item.x,
                y: item.y,
                revision: item._revision,
                ...(target.kind === 'node' ? { character_id: this.ctx.player().id } : {})
              }
            });
            await this.ctx.refresh();
          } catch (error) {
            Object.assign(item, drag.original);
            await this.ctx.refresh();
            throw error;
          }
        });
        return;
      }
      if (drag.distance < 6) {
        if (target?.kind === 'node')
          npcDialog(
            this.ctx,
            this.ctx.state.campaign.network.nodes.find((n) => n.id === target.id)
          );
        else if (target?.kind === 'edge')
          edgeDialog(
            this.ctx,
            this.ctx.state.campaign.network.links.find((e) => e.id === target.id)
          );
      }
    };
    this.viewport.addEventListener('pointerup', end, opts);
    this.viewport.addEventListener(
      'pointercancel',
      (event) => {
        this.pointers.delete(event.pointerId);
        if (this.drag?.item) {
          const item = this.drag.item;
          Object.assign(item, this.drag.original);
          const element = this.stage.querySelector(`[data-node="${item.id}"]`);
          if (element) {
            element.style.left = item.x * this.scene.width + 'px';
            element.style.top = item.y * this.scene.height + 'px';
          }
          this.edges();
        }
        this.drag = null;
        this.pinch = null;
        this.viewport.classList.remove('dragging');
      },
      opts
    );
  }
  destroy() {
    this.controller.abort();
  }
}
export function bindCanvas(ctx) {
  activeCanvas?.destroy();
  activeCanvas = null;
  bindAtlas(ctx);
  if (ctx.state.view === 'network' && $('#canvas-stage')) activeCanvas = new CampaignCanvas(ctx);
}
export async function canvasAction(action, data, ctx) {
  if (await atlasAction(action, data, ctx)) return true;
  if (action === 'canvas-zoom-in' || action === 'canvas-zoom-out') {
    activeCanvas?.zoom(action === 'canvas-zoom-in' ? 1.35 : 1 / 1.35);
    return true;
  }
  if (action === 'canvas-fit') {
    activeCanvas?.fit();
    return true;
  }
  if (action === 'network-add') {
    npcDialog(ctx);
    return true;
  }
  if (action === 'network-detail') {
    npcDialog(
      ctx,
      ctx.state.campaign.network.nodes.find((n) => n.id === data.id)
    );
    return true;
  }
  if (action === 'network-link') {
    edgeDialog(ctx);
    return true;
  }
  if (action === 'network-remove' || action === 'network-unlink') {
    const nodes = action === 'network-remove',
      item = ctx.state.campaign.network[nodes ? 'nodes' : 'links'].find((n) => n.id === data.id);
    modal(
      nodes ? 'Remover NPC e suas ligações?' : 'Remover esta ligação?',
      `<p>${esc(item.name || item.label)}</p>`,
      async () => {
        await api(`/api/network/${nodes ? 'nodes' : 'links'}/${item.id}`, {
          method: 'DELETE',
          data: { revision: item._revision, character_id: ctx.player()?.id }
        });
        await ctx.refresh();
      },
      { saveLabel: 'Remover' }
    );
    return true;
  }
  return false;
}
