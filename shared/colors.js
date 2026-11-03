export function colorHsl(hex) {
  let h=hex.replace('#','');
  if(h.length===3||h.length===4)h=[...h].map(c=>c+c).join('');
  const r=parseInt(h.slice(0,2),16)/255,g=parseInt(h.slice(2,4),16)/255,b=parseInt(h.slice(4,6),16)/255;
  const max=Math.max(r,g,b),min=Math.min(r,g,b),d=max-min,l=(max+min)/2;
  let hue=0;
  if(d)hue=(max===r?((g-b)/d+(g<b?6:0)):max===g?(b-r)/d+2:(r-g)/d+4)*60;
  return {h:hue,s:d?d/(1-Math.abs(2*l-1)):0,l,a:h.length===8?parseInt(h.slice(6),16)/255:1};
}
