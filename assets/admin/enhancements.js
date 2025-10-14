(function () {
    const focusFirstField = () => {
        const content = document.getElementById('content-main');
        if (!content) {
            return;
        }
        const selector = 'form input:not([type="hidden"]):not([disabled]), form textarea, form select';
        const firstField = content.querySelector(selector);
        if (firstField && typeof firstField.focus === 'function') {
            firstField.focus({ preventScroll: true });
        }
    };

    const focusSearchInput = () => {
        const searchBox = document.querySelector('#changelist-search input[name="q"]');
        if (!searchBox) {
            return;
        }
        if (!searchBox.placeholder) {
            searchBox.placeholder = 'Buscar registros…';
        }
        if (document.activeElement === document.body && typeof searchBox.focus === 'function') {
            searchBox.focus({ preventScroll: true });
        }
    };

    const registerSaveShortcut = () => {
        const handler = (event) => {
            if (!(event.ctrlKey || event.metaKey) || event.key !== 'Enter') {
                return;
            }
            const primarySave = document.querySelector(
                'form input[name="_save"], form button[name="_save"]'
            );
            if (primarySave) {
                event.preventDefault();
                primarySave.click();
            }
        };

        document.addEventListener('keydown', handler);
    };

    const init = () => {
        focusFirstField();
        focusSearchInput();
        registerSaveShortcut();
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
