// assets/js/ui/MessageCenter.js

const DEFAULT_OPTIONS = {
    autoDismissMs: 8000,
    resumeDismissMs: 3500,
    rootSelector: '[data-message-center]',
};

export default class MessageCenter {
    constructor(options = {}) {
        this.options = { ...DEFAULT_OPTIONS, ...options };
        this.root = null;
        this.list = null;
    }

    init() {
        if (typeof document === 'undefined') {
            return;
        }

        this.root = document.querySelector(this.options.rootSelector);
        if (!this.root) {
            return;
        }

        this.list = this.root.querySelector('[data-message-center-list]');
        if (!this.list) {
            return;
        }

        const cards = Array.from(this.list.querySelectorAll('[data-message-card]'));
        if (!cards.length) {
            this.root.setAttribute('hidden', '');
            return;
        }

        this.root.removeAttribute('hidden');

        cards.forEach((card, index) => {
            this._enhanceCard(card, index);
        });

        this._focusFirstCard(cards);
    }

    dismiss(card) {
        if (!card || card.classList.contains('is-leaving')) {
            return;
        }

        this._clearAutoDismissTimer(card);
        card.classList.add('is-leaving');
        card.setAttribute('aria-hidden', 'true');

        const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
        if (prefersReducedMotion) {
            card.remove();
            this._updateVisibility();
            return;
        }

        window.setTimeout(() => {
            if (card.isConnected) {
                card.remove();
                this._updateVisibility();
            }
        }, 280);
    }

    _enhanceCard(card, index) {
        card.dataset.messageIndex = String(index);

        const dismissButton = card.querySelector('[data-message-dismiss]');
        if (dismissButton) {
            dismissButton.addEventListener('click', () => this.dismiss(card));
        }

        card.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' || event.key === 'Esc') {
                event.stopPropagation();
                this.dismiss(card);
            }
        });

        card.addEventListener('animationend', (event) => {
            if (event.animationName === 'messageSlideOut') {
                card.remove();
                this._updateVisibility();
            }
        });

        card.addEventListener('transitionend', (event) => {
            if (event.propertyName === 'opacity' && card.classList.contains('is-leaving')) {
                card.remove();
                this._updateVisibility();
            }
        });

        const shouldAutoDismiss = card.dataset.autoDismiss !== 'false';
        const dismissMs = this._deriveDismissTimeout(card);
        if (shouldAutoDismiss) {
            card.style.setProperty('--message-dismiss-duration', `${dismissMs}ms`);
            this._startAutoDismissTimer(card, dismissMs);
            card.addEventListener('mouseenter', () => this._handlePause(card), { passive: true });
            card.addEventListener('mouseleave', () => this._handleResume(card), { passive: true });
            card.addEventListener('focusin', () => this._handlePause(card));
            card.addEventListener('focusout', () => this._handleResume(card));
        } else {
            card.style.removeProperty('--message-dismiss-duration');
        }
    }

    _focusFirstCard(cards) {
        if (!cards.length) {
            return;
        }

        const alreadyFocused = cards.some(card => card.contains(document.activeElement));
        if (alreadyFocused) {
            return;
        }

        const firstCard = cards[0];
        firstCard.setAttribute('tabindex', '-1');
        firstCard.focus({ preventScroll: true });
        firstCard.addEventListener('blur', () => {
            firstCard.removeAttribute('tabindex');
        }, { once: true });
    }

    _deriveDismissTimeout(card) {
        const rawValue = parseInt(card.dataset.autoDismissMs, 10);
        if (!Number.isNaN(rawValue) && rawValue > 0) {
            return rawValue;
        }
        return this.options.autoDismissMs;
    }

    _startAutoDismissTimer(card, timeout) {
        this._clearAutoDismissTimer(card);
        const timerId = window.setTimeout(() => this.dismiss(card), timeout);
        card.dataset.dismissTimerId = String(timerId);
        card.dataset.dismissTimeout = String(timeout);
    }

    _clearAutoDismissTimer(card) {
        const timerId = parseInt(card.dataset.dismissTimerId, 10);
        if (!Number.isNaN(timerId)) {
            window.clearTimeout(timerId);
        }
        delete card.dataset.dismissTimerId;
    }

    _handlePause(card) {
        this._clearAutoDismissTimer(card);
    }

    _handleResume(card) {
        if (card.dataset.autoDismiss === 'false') {
            return;
        }

        const previousTimeout = parseInt(card.dataset.dismissTimeout || '', 10);
        const timeout = !Number.isNaN(previousTimeout) && previousTimeout > 0
            ? Math.max(Math.min(previousTimeout, this.options.autoDismissMs), 2500)
            : this.options.resumeDismissMs;
        this._startAutoDismissTimer(card, timeout);
    }

    _updateVisibility() {
        if (!this.list) {
            return;
        }

        const remaining = this.list.querySelectorAll('[data-message-card]').length;
        if (remaining === 0 && this.root) {
            this.root.setAttribute('hidden', '');
        }
    }
}
