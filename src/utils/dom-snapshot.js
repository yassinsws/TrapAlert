/**
 * Serializes the current DOM state into a snapshot.
 * Captures document structure, styles, and form values.
 */
export function captureDOMSnapshot() {
    const doc = document.cloneNode(true);
    const root = doc.documentElement;

    // 1. Convert relative URLs to absolute URLs
    const base = window.location.href;

    const convertToAbs = (attr) => {
        root.querySelectorAll(`[${attr}]`).forEach(el => {
            const val = el.getAttribute(attr);
            if (val && !val.startsWith('http') && !val.startsWith('data:') && !val.startsWith('//')) {
                try {
                    el.setAttribute(attr, new URL(val, base).href);
                } catch (e) { }
            }
        });
    };

    ['src', 'href'].forEach(convertToAbs);

    // 2. Capture dynamic state that isn't in outerHTML (scroll, inputs)
    // We iterate the REAL document and apply values to the CLONE
    const allRealElements = document.querySelectorAll('*');
    const allCloneElements = root.querySelectorAll('*');

    allRealElements.forEach((realEl, i) => {
        const cloneEl = allCloneElements[i];
        if (!cloneEl) return;

        // Capture input values
        if (realEl.tagName === 'INPUT' || realEl.tagName === 'TEXTAREA' || realEl.tagName === 'SELECT') {
            cloneEl.value = realEl.value;
        }

        // Capture canvas as data URL
        if (realEl.tagName === 'CANVAS') {
            const img = doc.createElement('img');
            img.src = realEl.toDataURL();
            img.style.cssText = realEl.style.cssText;
            cloneEl.replaceWith(img);
        }

        // Capture scroll positions as attributes
        if (realEl.scrollTop > 0) cloneEl.setAttribute('data-ta-scroll-top', realEl.scrollTop);
        if (realEl.scrollLeft > 0) cloneEl.setAttribute('data-ta-scroll-left', realEl.scrollLeft);
    });

    // 3. Inject computed styles for reliability
    // (Optional: can be heavy, but ensures visual fidelity)

    return root.outerHTML;
}
