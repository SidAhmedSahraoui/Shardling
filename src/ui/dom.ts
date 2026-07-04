export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className = "",
  text = "",
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) {
    node.className = className;
  }
  if (text) {
    node.textContent = text;
  }
  return node;
}

let uidCounter = 0;

export function uniqueId(prefix: string): string {
  uidCounter += 1;
  return `${prefix}-${uidCounter}`;
}

export class ListenerBag {
  private readonly disposers: (() => void)[] = [];

  add<K extends keyof HTMLElementEventMap>(
    target: HTMLElement,
    type: K,
    listener: (ev: HTMLElementEventMap[K]) => void,
  ): void {
    target.addEventListener(type, listener);
    this.disposers.push(() => {
      target.removeEventListener(type, listener);
    });
  }

  addWindow<K extends keyof WindowEventMap>(
    type: K,
    listener: (ev: WindowEventMap[K]) => void,
  ): void {
    window.addEventListener(type, listener);
    this.disposers.push(() => {
      window.removeEventListener(type, listener);
    });
  }

  dispose(): void {
    for (const dispose of this.disposers) {
      dispose();
    }
    this.disposers.length = 0;
  }
}

export function cycleFocus(
  controls: readonly HTMLElement[],
  active: Element | null,
  dir: 1 | -1,
): void {
  if (controls.length === 0) {
    return;
  }
  const index = controls.findIndex((control) => control === active);
  const next =
    index === -1
      ? dir === 1
        ? 0
        : controls.length - 1
      : (index + dir + controls.length) % controls.length;
  controls[next]?.focus({ preventScroll: true });
}
