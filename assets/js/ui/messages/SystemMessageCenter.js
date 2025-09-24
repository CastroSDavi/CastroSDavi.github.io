// File: assets/js/ui/messages/SystemMessageCenter.js

import { resolveSystemMessage } from './index.js';
import { MESSAGE_TYPES } from './catalog.js';

const TOAST_DEFAULT_TITLES = {
    [MESSAGE_TYPES.SUCCESS]: 'Tudo certo!',
    [MESSAGE_TYPES.ERROR]: 'Algo não saiu como esperado',
    [MESSAGE_TYPES.WARNING]: 'Atenção necessária',
    [MESSAGE_TYPES.INFO]: 'Atualização importante',
};

const MESSAGE_TYPE_ALIASES = {
    error: MESSAGE_TYPES.ERROR,
    danger: MESSAGE_TYPES.ERROR,
    warning: MESSAGE_TYPES.WARNING,
    info: MESSAGE_TYPES.INFO,
    success: MESSAGE_TYPES.SUCCESS,
    ok: MESSAGE_TYPES.SUCCESS,
};

const LEVEL_TO_TYPE_MAP = {
    50: MESSAGE_TYPES.ERROR,
    40: MESSAGE_TYPES.ERROR,
    30: MESSAGE_TYPES.WARNING,
    25: MESSAGE_TYPES.SUCCESS,
    20: MESSAGE_TYPES.INFO,
    10: MESSAGE_TYPES.INFO,
};

const DEFAULT_AUTO_DISMISS = 8000;

export default class SystemMessageCenter {
    constructor({
        toastContainerSelector = '#global-toast-stack',
        documentRef = typeof document !== 'undefined' ? document : null,
        inlineRenderer = null,
        inlineClearer = null,
        autoDismissTimeout = DEFAULT_AUTO_DISMISS,
    } = {}) {
        this.document = documentRef;
        this.toastContainerSelector = toastContainerSelector;
        this.toastContainer = null;

        this.inlineRenderer = inlineRenderer;
        this.inlineClearer = inlineClearer;

        this.autoDismissTimeout = autoDismissTimeout;

        this.toasts = new Map();
        this.history = [];
        this.lastInlineMessage = null;
    }

    setInlineRenderer(renderer, clearer = null) {
        this.inlineRenderer = renderer;
        if (typeof clearer === 'function') {
            this.inlineClearer = clearer;
        }
    }

    showInline(messageInput, resolveOptions = {}) {
        const messageConfig = this._resolveMessage(messageInput, resolveOptions);
        this.lastInlineMessage = messageConfig;
        this.history.push({
            channel: 'inline',
            timestamp: Date.now(),
            config: messageConfig,
        });

        if (typeof this.inlineRenderer === 'function') {
            this.inlineRenderer(messageConfig);
        }

        return messageConfig;
    }

    clearInline() {
        this.lastInlineMessage = null;
        if (typeof this.inlineClearer === 'function') {
            this.inlineClearer();
        }
    }

    showToast(messageInput, {
        resolveOptions = {},
        autoDismiss = true,
        dismissIn = null,
        id = null,
    } = {}) {
        const messageConfig = this._resolveMessage(messageInput, resolveOptions);
        const toastId = id || `toast-${Date.now()}-${Math.random().toString(16).slice(2)}`;
        const timeout = Number.isFinite(dismissIn) ? Number(dismissIn) : this.autoDismissTimeout;

        const toastRecord = {
            id: toastId,
            config: messageConfig,
            channel: 'toast',
            timestamp: Date.now(),
        };

        this.history.push(toastRecord);
        this._renderToast(toastRecord, { autoDismiss, timeout });

        return toastId;
    }

    dismissToast(toastId) {
        const toastData = this.toasts.get(toastId);
        if (!toastData) {
            return;
        }

        const { element, timeoutId } = toastData;
        if (timeoutId) {
            clearTimeout(timeoutId);
        }

        element.classList.add('is-leaving');
        const removeElement = () => {
            element.removeEventListener('transitionend', removeElement);
            if (element.parentElement) {
                element.parentElement.removeChild(element);
            }
        };

        element.addEventListener('transitionend', removeElement);
        window.setTimeout(removeElement, 400);
        this.toasts.delete(toastId);
    }

    consumeSeedMessages({
        selector = '[data-django-message]',
    } = {}) {
        if (!this.document) {
            return [];
        }

        const nodes = Array.from(this.document.querySelectorAll(selector));
        if (nodes.length === 0) {
            return [];
        }

        const consumed = nodes.map((node) => {
            const dataset = node.dataset || {};
            const extraTags = this._tokenize(dataset.messageExtra);
            const preferredChannel = dataset.messageChannel
                || (extraTags.includes('inline') ? 'inline' : 'toast');

            const input = this._buildMessageInputFromDataset(dataset);
            const resolveOptions = {
                defaultType: this._resolveType(input.type),
                defaultCentered: extraTags.includes('centered'),
            };

            const autoDismiss = dataset.messageAutodismiss
                ? dataset.messageAutodismiss !== 'false'
                : !extraTags.includes('sticky');
            const dismissIn = dataset.messageDismissIn
                ? Number.parseInt(dataset.messageDismissIn, 10)
                : null;

            if (preferredChannel === 'inline') {
                this.showInline(input, resolveOptions);
            } else {
                this.showToast(input, { resolveOptions, autoDismiss, dismissIn });
            }

            return { input, resolveOptions, channel: preferredChannel };
        });

        const seedContainer = nodes[0].parentElement;
        nodes.forEach((node) => node.remove());
        if (seedContainer && seedContainer.dataset?.messageSeed !== undefined) {
            seedContainer.remove();
        }

        return consumed;
    }

    _resolveMessage(messageInput, resolveOptions = {}) {
        const messageConfig = resolveSystemMessage(messageInput, resolveOptions);

        if (!messageConfig.type) {
            messageConfig.type = this._resolveType(resolveOptions.defaultType)
                || MESSAGE_TYPES.INFO;
        } else {
            messageConfig.type = this._resolveType(messageConfig.type) || MESSAGE_TYPES.INFO;
        }

        if (!messageConfig.title) {
            messageConfig.title = TOAST_DEFAULT_TITLES[messageConfig.type] || null;
        }

        if (!messageConfig.body && typeof messageInput === 'string') {
            messageConfig.body = messageInput;
        }

        if (!messageConfig.body && messageConfig.supportingText) {
            messageConfig.body = messageConfig.supportingText;
            messageConfig.supportingText = null;
        }

        return messageConfig;
    }

    _renderToast(toastRecord, { autoDismiss, timeout }) {
        if (!this.document) {
            return;
        }

        const container = this._ensureToastContainer();
        if (!container) {
            return;
        }

        const { id, config } = toastRecord;
        const toastEl = this.document.createElement('div');
        toastEl.className = `toast toast--${config.type}`;
        toastEl.dataset.toastId = id;
        toastEl.setAttribute('role', this._resolveRole(config));
        toastEl.setAttribute('aria-live', config.type === MESSAGE_TYPES.SUCCESS ? 'polite' : 'assertive');

        const iconName = config.icon || this._resolveIcon(config.type);
        if (iconName) {
            const iconSpan = this.document.createElement('span');
            iconSpan.className = 'toast__icon material-symbols-outlined';
            iconSpan.setAttribute('aria-hidden', 'true');
            iconSpan.textContent = iconName;
            toastEl.appendChild(iconSpan);
        }

        const content = this.document.createElement('div');
        content.className = 'toast__content';

        if (config.title) {
            const titleEl = this.document.createElement('p');
            titleEl.className = 'toast__title';
            titleEl.textContent = config.title;
            content.appendChild(titleEl);
        }

        if (config.body) {
            const bodyEl = this.document.createElement('p');
            bodyEl.className = 'toast__body';
            bodyEl.textContent = config.body;
            content.appendChild(bodyEl);
        }

        if (config.supportingText) {
            const supportingEl = this.document.createElement('p');
            supportingEl.className = 'toast__supporting';
            supportingEl.textContent = config.supportingText;
            content.appendChild(supportingEl);
        }

        toastEl.appendChild(content);

        const closeBtn = this.document.createElement('button');
        closeBtn.type = 'button';
        closeBtn.className = 'toast__close-btn';
        closeBtn.setAttribute('aria-label', 'Fechar notificação');

        const closeIcon = this.document.createElement('span');
        closeIcon.className = 'material-symbols-outlined';
        closeIcon.setAttribute('aria-hidden', 'true');
        closeIcon.textContent = 'close';
        closeBtn.appendChild(closeIcon);

        closeBtn.addEventListener('click', () => this.dismissToast(id));
        toastEl.appendChild(closeBtn);

        container.appendChild(toastEl);

        window.requestAnimationFrame(() => {
            toastEl.classList.add('is-visible');
        });

        const toastEntry = { element: toastEl, timeoutId: null };

        if (autoDismiss) {
            const scheduleDismiss = () => {
                toastEntry.timeoutId = window.setTimeout(() => {
                    this.dismissToast(id);
                }, Math.max(timeout, 2000));
            };

            scheduleDismiss();

            toastEl.addEventListener('mouseenter', () => {
                if (toastEntry.timeoutId) {
                    clearTimeout(toastEntry.timeoutId);
                }
            });

            toastEl.addEventListener('mouseleave', () => {
                scheduleDismiss();
            });
        }

        this.toasts.set(id, toastEntry);
    }

    _ensureToastContainer() {
        if (!this.document) {
            return null;
        }

        if (this.toastContainer && this.toastContainer.isConnected) {
            return this.toastContainer;
        }

        const existing = this.toastContainerSelector
            ? this.document.querySelector(this.toastContainerSelector)
            : null;

        if (existing) {
            this.toastContainer = existing;
            return this.toastContainer;
        }

        const container = this.document.createElement('div');
        container.className = 'toast-stack';
        container.setAttribute('role', 'region');
        container.setAttribute('aria-live', 'polite');
        container.setAttribute('aria-atomic', 'false');
        if (this.toastContainerSelector && this.toastContainerSelector.startsWith('#')) {
            container.id = this.toastContainerSelector.slice(1);
        }

        this.document.body.appendChild(container);
        this.toastContainer = container;
        return this.toastContainer;
    }

    _resolveType(rawType) {
        if (!rawType) {
            return null;
        }

        const normalized = String(rawType).trim().toLowerCase();
        return MESSAGE_TYPE_ALIASES[normalized] || null;
    }

    _resolveIcon(type) {
        switch (type) {
            case MESSAGE_TYPES.ERROR:
                return 'error';
            case MESSAGE_TYPES.WARNING:
                return 'warning';
            case MESSAGE_TYPES.SUCCESS:
                return 'check_circle';
            default:
                return 'info';
        }
    }

    _resolveRole(config) {
        if (config.role) {
            return config.role;
        }

        if (config.type === MESSAGE_TYPES.ERROR || config.type === MESSAGE_TYPES.WARNING) {
            return 'alert';
        }

        return 'status';
    }

    _tokenize(value) {
        if (!value) {
            return [];
        }

        return String(value)
            .split(/\s+/)
            .map((token) => token.trim())
            .filter(Boolean);
    }

    _buildMessageInputFromDataset(dataset) {
        const tags = this._tokenize(dataset.messageTags);
        const level = Number.parseInt(dataset.messageLevel ?? '', 10);
        const levelType = Number.isFinite(level) ? LEVEL_TO_TYPE_MAP[level] : null;
        const explicitType = dataset.messageType || tags[0] || levelType || null;

        const input = {
            body: dataset.messageBody || '',
            supportingText: dataset.messageSupporting || null,
            title: dataset.messageTitle || null,
            type: explicitType,
        };

        if (dataset.messageIcon) {
            input.icon = dataset.messageIcon;
        }

        if (dataset.messageDetail) {
            input.detail = dataset.messageDetail;
        }

        return input;
    }
}
