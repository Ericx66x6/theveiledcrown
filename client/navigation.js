// Route snapshots stay in memory. Browser history receives only an opaque entry ID.
export class NavigationTrail {
  constructor() {
    this.entries = [];
    this.index = -1;
    this.session = String(Date.now()) + '-' + Math.random().toString(36).slice(2);
    this.serial = 0;
  }
  start(point) {
    this.entries = [];
    this.index = -1;
    return this.push(point);
  }
  push(point) {
    this.entries.splice(this.index + 1);
    const entry = { id: ++this.serial, point };
    this.entries.push(entry);
    this.index = this.entries.length - 1;
    return this.marker();
  }
  update(point) {
    if (this.current) this.current.point = point;
  }
  select(marker) {
    if (marker?.coroaNav !== this.session) return null;
    const i = this.entries.findIndex((e) => e.id === marker.entry);
    if (i < 0) return null;
    this.index = i;
    return this.current.point;
  }
  marker() {
    return { coroaNav: this.session, entry: this.current?.id };
  }
  get current() {
    return this.entries[this.index];
  }
  get canBack() {
    return this.index > 0;
  }
}
