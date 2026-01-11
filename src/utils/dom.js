/**
 * Get CSS selector for element
 * @param {HTMLElement} element 
 * @returns {string} Unique-ish selector
 */
export function getElementSelector(element) {
    if (!element || element === document) return 'document';
    if (element === window) return 'window';

    if (element.id) {
        return `#${element.id}`;
    }

    if (element.className && typeof element.className === 'string') {
        const classes = element.className.trim().split(/\s+/).join('.');
        if (classes) {
            return `${element.tagName.toLowerCase()}.${classes}`;
        }
    }

    return element.tagName.toLowerCase();
}

/**
 * Check if element is interactive
 * @param {HTMLElement} element 
 * @returns {boolean}
 */
export function isInteractiveElement(element) {
    const tagName = element.tagName.toLowerCase();
    const interactiveTags = ['a', 'button', 'input', 'select', 'textarea'];

    if (interactiveTags.includes(tagName)) return true;
    if (element.hasAttribute('onclick')) return true;
    if (element.getAttribute('role') === 'button') return true;
    if (element.hasAttribute('href')) return true;
    if (element.hasAttribute('tabindex') && element.getAttribute('tabindex') !== '-1') return true;

    return false;
}

/**
 * Check if element has pointer cursor
 * @param {HTMLElement} element 
 * @returns {boolean}
 */
export function hasPointerCursor(element) {
    try {
        const style = window.getComputedStyle(element);
        return style.cursor === 'pointer';
    } catch (e) {
        return false;
    }
}

/**
 * Get simple XPath for element
 * @param {HTMLElement} element 
 * @returns {string}
 */
export function getElementXPath(element) {
    if (element.id !== '') return `//*[@id="${element.id}"]`;
    if (element === document.body) return '/html/body';

    let ix = 0;
    const siblings = element.parentNode ? element.parentNode.childNodes : [];

    for (let i = 0; i < siblings.length; i++) {
        const sibling = siblings[i];
        if (sibling === element) {
            return getElementXPath(element.parentNode) + '/' + element.tagName.toLowerCase() + '[' + (ix + 1) + ']';
        }
        if (sibling.nodeType === 1 && sibling.tagName === element.tagName) {
            ix++;
        }
    }
    return '';
}
