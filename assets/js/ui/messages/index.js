import { MESSAGE_CATALOG, MESSAGE_TYPES } from './catalog.js';

const DEFAULT_ROLE = 'alert';

const resolveValue = (value, params) => {
    if (typeof value === 'function') {
        try {
            return value(params);
        } catch (error) {
            console.warn('SystemMessages: erro ao resolver valor dinâmico.', error);
            return null;
        }
    }
    return value ?? null;
};

const cloneActions = (actions = [], params) => actions
    .map(action => {
        if (!action || typeof action !== 'object') {
            return null;
        }
        const cloned = { ...action };
        cloned.label = resolveValue(action.label, params) || '';
        cloned.icon = resolveValue(action.icon, params);
        cloned.variant = action.variant || 'primary';
        cloned.ariaLabel = resolveValue(action.ariaLabel, params) || null;
        return cloned;
    })
    .filter(Boolean);

const cloneFeatures = (features = [], params) => features
    .map(feature => resolveValue(feature, params))
    .filter(feature => typeof feature === 'string' && feature.trim().length > 0);

const getCatalogEntry = (keyPath) => {
    if (typeof keyPath !== 'string') {
        return null;
    }
    const segments = keyPath.split('.').filter(Boolean);
    if (segments.length === 0) {
        return null;
    }

    return segments.reduce((current, segment) => {
        if (current && typeof current === 'object') {
            return current[segment] ?? null;
        }
        return null;
    }, MESSAGE_CATALOG);
};

const normalizeMessageInput = (input) => {
    if (typeof input === 'string') {
        const potentialEntry = getCatalogEntry(input);
        if (potentialEntry) {
            return { key: input };
        }
        return { body: input };
    }

    if (input && typeof input === 'object') {
        return { ...input };
    }

    return { body: String(input ?? '') };
};

const resolveBody = (entry, params, overrides, fallbackBody) => {
    if (typeof overrides.body === 'string') {
        return overrides.body;
    }

    const resolved = resolveValue(entry?.body, params);
    if (typeof resolved === 'string') {
        return resolved;
    }

    if (typeof fallbackBody === 'string') {
        return fallbackBody;
    }

    return null;
};

const resolveSupportingText = (entry, params, overrides, fallback) => {
    if (typeof overrides.supportingText === 'string') {
        return overrides.supportingText;
    }

    const resolved = resolveValue(entry?.supportingText, params);
    if (typeof resolved === 'string') {
        return resolved;
    }

    if (typeof fallback === 'string') {
        return fallback;
    }

    return null;
};

export const resolveSystemMessage = (input, {
    defaultType = MESSAGE_TYPES.INFO,
    defaultCentered = false,
    defaultRole = DEFAULT_ROLE,
} = {}) => {
    const normalized = normalizeMessageInput(input);
    const {
        key = null,
        params = {},
        body: explicitBody,
        supportingText: explicitSupporting,
        actions: explicitActions,
        features: explicitFeatures,
        type: explicitType,
        role: explicitRole,
        isTextCentered: explicitCentered,
        fallbackMessage,
        detail,
        ...rest
    } = normalized;

    const catalogEntry = key ? getCatalogEntry(key) : null;
    const fallbackBody = typeof explicitBody === 'string' ? explicitBody : fallbackMessage;
    const fallbackSupporting = typeof explicitSupporting === 'string' ? explicitSupporting : null;
    const entryParams = { ...params, detail };

    const resolvedType = explicitType || catalogEntry?.type || defaultType;
    const isTextCentered = typeof explicitCentered === 'boolean'
        ? explicitCentered
        : (catalogEntry?.isTextCentered ?? defaultCentered);

    const body = resolveBody(catalogEntry, entryParams, normalized, fallbackBody);
    const supportingText = resolveSupportingText(catalogEntry, entryParams, normalized, fallbackSupporting || detail);
    const title = typeof normalized.title === 'string'
        ? normalized.title
        : resolveValue(catalogEntry?.title, entryParams);

    const actions = Array.isArray(explicitActions)
        ? cloneActions(explicitActions, entryParams)
        : cloneActions(catalogEntry?.actions, entryParams);

    const features = Array.isArray(explicitFeatures)
        ? cloneFeatures(explicitFeatures, entryParams)
        : cloneFeatures(catalogEntry?.features, entryParams);

    return {
        key,
        type: resolvedType,
        title: title || null,
        body: body || null,
        supportingText: supportingText || null,
        actions,
        features,
        isTextCentered,
        role: explicitRole || catalogEntry?.role || defaultRole,
        icon: normalized.icon || catalogEntry?.icon || null,
        detail: detail || null,
        meta: {
            catalogEntryExists: Boolean(catalogEntry),
            originalInput: input,
            restOverrides: rest,
        },
    };
};

export const hasCatalogMessage = (key) => Boolean(getCatalogEntry(key));
