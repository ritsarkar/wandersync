import { delay } from '@browser-mcp/shared';

/**
 * Simulate human-like mouse click on an element
 */
export async function simulateClick(element: HTMLElement): Promise<void> {
  element.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
  await delay(100);

  const rect = element.getBoundingClientRect();
  const clientX = rect.left + rect.width / 2;
  const clientY = rect.top + rect.height / 2;

  const eventInit: MouseEventInit = {
    bubbles: true,
    cancelable: true,
    view: window,
    clientX,
    clientY
  };

  element.dispatchEvent(new MouseEvent('pointerdown', eventInit));
  element.dispatchEvent(new MouseEvent('mousedown', eventInit));
  element.focus();
  await delay(50);

  element.dispatchEvent(new MouseEvent('pointerup', eventInit));
  element.dispatchEvent(new MouseEvent('mouseup', eventInit));
  element.dispatchEvent(new MouseEvent('click', eventInit));
}

/**
 * Simulate typing text into an input or contenteditable element
 */
export async function simulateType(
  element: HTMLElement,
  text: string,
  clearFirst = true,
  pressEnter = false
): Promise<void> {
  element.scrollIntoView({ behavior: 'smooth', block: 'center' });
  element.focus();
  await delay(50);

  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
    if (clearFirst) {
      element.value = '';
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));
    }

    // Set value and trigger input events
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      'value'
    )?.set;

    if (nativeInputValueSetter && element instanceof HTMLInputElement) {
      nativeInputValueSetter.call(element, (clearFirst ? '' : element.value) + text);
    } else {
      element.value = (clearFirst ? '' : element.value) + text;
    }

    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  } else if (element.isContentEditable) {
    if (clearFirst) {
      element.textContent = '';
    }
    document.execCommand('insertText', false, text);
    element.dispatchEvent(new Event('input', { bubbles: true }));
  }

  if (pressEnter) {
    await delay(100);
    await simulateKeyPress(element, 'Enter');
  }
}

/**
 * Simulate pressing a keyboard key
 */
export async function simulateKeyPress(element: HTMLElement, key: string): Promise<void> {
  const keyCodeMap: Record<string, number> = {
    Enter: 13,
    Tab: 9,
    Escape: 27,
    Backspace: 8,
    ArrowDown: 40,
    ArrowUp: 38,
    ArrowLeft: 37,
    ArrowRight: 39,
    Space: 32
  };

  const keyCode = keyCodeMap[key] || 0;

  const keyEventInit: KeyboardEventInit = {
    key,
    code: key,
    keyCode,
    which: keyCode,
    bubbles: true,
    cancelable: true
  };

  element.dispatchEvent(new KeyboardEvent('keydown', keyEventInit));
  element.dispatchEvent(new KeyboardEvent('keypress', keyEventInit));
  await delay(30);
  element.dispatchEvent(new KeyboardEvent('keyup', keyEventInit));

  // If Enter is pressed inside an input within a form, submit the form if standard behavior didn't trigger
  if (key === 'Enter' && element instanceof HTMLInputElement && element.form) {
    try {
      element.form.requestSubmit();
    } catch {
      element.form.submit();
    }
  }
}

/**
 * Scroll page or element
 */
export async function simulateScroll(
  direction: 'up' | 'down' | 'top' | 'bottom' = 'down',
  amount = 500,
  element?: HTMLElement | null
): Promise<void> {
  const target = element || window;

  if (target === window) {
    switch (direction) {
      case 'top':
        window.scrollTo({ top: 0, behavior: 'smooth' });
        break;
      case 'bottom':
        window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
        break;
      case 'up':
        window.scrollBy({ top: -amount, behavior: 'smooth' });
        break;
      case 'down':
      default:
        window.scrollBy({ top: amount, behavior: 'smooth' });
        break;
    }
  } else if (element) {
    switch (direction) {
      case 'top':
        element.scrollTop = 0;
        break;
      case 'bottom':
        element.scrollTop = element.scrollHeight;
        break;
      case 'up':
        element.scrollTop -= amount;
        break;
      case 'down':
      default:
        element.scrollTop += amount;
        break;
    }
  }

  await delay(200);
}
