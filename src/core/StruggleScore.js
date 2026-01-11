/**
 * StruggleScore - Manages the frustration meter (0-100)
 */
export class StruggleScore {
    constructor(decayRate = 2) {
        this.score = 0;
        this.lastDecayTime = Date.now();
        this.decayRate = decayRate; // points per second
    }

    setDecayRate(rate) {
        this.decayRate = rate;
    }

    add(points) {
        this.score = this.score + points;
        return this.score;
    }

    subtract(points) {
        this.score = Math.max(0, this.score - points);
        return this.score;
    }

    decay() {
        const now = Date.now();
        const elapsed = (now - this.lastDecayTime) / 1000; // seconds

        if (elapsed >= 1) {
            const decayAmount = elapsed * this.decayRate;
            this.subtract(decayAmount);
            this.lastDecayTime = now;
        }
    }

    get() {
        return this.score;
    }

    reset() {
        this.score = 0;
        this.lastDecayTime = Date.now();
    }
}
