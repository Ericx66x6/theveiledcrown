// A single swipe never changes a marker. The second tap arms dragging.
export function guardedMarker(
  element,
  { editable, onTap, onStart, onMove, onEnd, onCancel, signal }
) {
  let tapTimer;
  let down = null,
    lastTap = null,
    armedUntil = 0;
  const options = { signal };
  element.addEventListener(
    'pointerdown',
    (event) => {
      if (down || event.isPrimary === false || (event.button && event.button !== 0)) return;
      const now = performance.now(),
        near = lastTap && Math.hypot(event.clientX - lastTap.x, event.clientY - lastTap.y) < 28;
      const armed =
        editable() && (now < armedUntil || event.detail >= 2 || (near && now - lastTap.at < 450));
      down = {
        x: event.clientX,
        y: event.clientY,
        lastX: event.clientX,
        lastY: event.clientY,
        pointerId: event.pointerId,
        armed,
        distance: 0
      };
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
      if (!down || down.pointerId !== event.pointerId) return;
      down.distance = Math.hypot(event.clientX - down.x, event.clientY - down.y);
      down.lastX = event.clientX;
      down.lastY = event.clientY;
      if (!down.armed) return;
      event.preventDefault();
      event.stopPropagation();
      if (down.distance > 5) onMove(event);
    },
    options
  );
  const finish = (event) => {
    if (!down || down.pointerId !== event.pointerId) return;
    const gesture = down;
    down = null;
    const cancelled = event.type !== 'pointerup';
    if (!cancelled) {
      gesture.distance = Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y);
      if (
        gesture.armed &&
        gesture.distance > 5 &&
        (gesture.lastX !== event.clientX || gesture.lastY !== event.clientY)
      )
        onMove(event);
    }
    if (gesture.armed) {
      event.preventDefault();
      event.stopPropagation();
      element.classList.remove('drag-armed');
      if (element.hasPointerCapture(event.pointerId))
        element.releasePointerCapture(event.pointerId);
      if (cancelled) {
        armedUntil = 0;
        lastTap = null;
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
  element.addEventListener('lostpointercapture', finish, options);
  signal?.addEventListener(
    'abort',
    () => {
      clearTimeout(tapTimer);
      if (down?.armed) {
        element.classList.remove('drag-armed');
        if (element.hasPointerCapture(down.pointerId))
          element.releasePointerCapture(down.pointerId);
        onCancel?.();
      }
      down = null;
    },
    { once: true }
  );
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
