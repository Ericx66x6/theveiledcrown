// A single swipe never changes a marker. The second tap arms dragging.
export function guardedMarker(
  element,
  { editable, onTap, onStart, onMove, onEnd, onCancel, signal }
) {
  let tapTimer;
  signal?.addEventListener('abort', () => clearTimeout(tapTimer), { once: true });
  let down = null,
    lastTap = null,
    armedUntil = 0;
  const options = { signal };
  element.addEventListener(
    'pointerdown',
    (event) => {
      if (event.button && event.button !== 0) return;
      const now = performance.now(),
        near = lastTap && Math.hypot(event.clientX - lastTap.x, event.clientY - lastTap.y) < 28;
      const armed =
        editable() && (now < armedUntil || event.detail >= 2 || (near && now - lastTap.at < 450));
      down = { x: event.clientX, y: event.clientY, armed, distance: 0 };
      if (armed) {
        clearTimeout(tapTimer);
        armedUntil = now + 2200;
        event.preventDefault();
        event.stopPropagation();
        element.setPointerCapture(event.pointerId);
        element.classList.add('drag-armed');
        onStart?.();
      }
    },
    { ...options, capture: true }
  );
  element.addEventListener(
    'pointermove',
    (event) => {
      if (!down) return;
      down.distance = Math.hypot(event.clientX - down.x, event.clientY - down.y);
      if (!down.armed) return;
      event.preventDefault();
      event.stopPropagation();
      if (down.distance > 5) onMove(event);
    },
    options
  );
  const finish = (event) => {
    if (!down) return;
    const gesture = down;
    down = null;
    if (gesture.armed) {
      event.preventDefault();
      event.stopPropagation();
      element.classList.remove('drag-armed');
      if (element.hasPointerCapture(event.pointerId))
        element.releasePointerCapture(event.pointerId);
      if (event.type === 'pointercancel') {
        armedUntil = 0;
        onCancel?.();
        return;
      }
      const moved = gesture.distance > 5;
      if (moved) {
        armedUntil = 0;
        lastTap = null;
      }
      onEnd(moved);
      return;
    }
    if (event.type === 'pointerup' && gesture.distance < 8) {
      lastTap = { x: event.clientX, y: event.clientY, at: performance.now() };
      clearTimeout(tapTimer);
      tapTimer = setTimeout(onTap, 330);
    } else lastTap = null;
  };
  element.addEventListener('pointerup', finish, options);
  element.addEventListener('pointercancel', finish, options);
  element.addEventListener(
    'click',
    (event) => {
      event.preventDefault();
      event.stopPropagation();
    },
    options
  );
  element.addEventListener(
    'dblclick',
    (event) => {
      event.preventDefault();
      event.stopPropagation();
    },
    options
  );
  element.addEventListener(
    'keydown',
    (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        onTap();
      }
    },
    options
  );
}
