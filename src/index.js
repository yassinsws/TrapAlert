import { TrapAlert } from './core/TrapAlert.js';

// Export for ES modules
export { TrapAlert };

// Export for UMD/Browser
if (typeof window !== 'undefined') {
    window.TrapAlert = {
        init: (config) => new TrapAlert(config)
    };
}
