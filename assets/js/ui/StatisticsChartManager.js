// assets/js/ui/StatisticsChartManager.js

const DEFAULT_PERIOD = "30d";

function formatNumber(value) {
    if (value === undefined || value === null) {
        return "--";
    }
    try {
        return Number(value).toLocaleString("pt-BR");
    } catch (error) {
        return String(value);
    }
}

function formatDuration(seconds) {
    if (seconds === undefined || seconds === null) {
        return "--";
    }

    const totalSeconds = Math.max(0, Number(seconds));
    if (Number.isNaN(totalSeconds) || totalSeconds === 0) {
        return "0 min";
    }

    const minutes = Math.floor(totalSeconds / 60);
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;

    if (hours > 0) {
        return `${hours}h ${remainingMinutes}min`;
    }

    if (minutes > 0) {
        return `${minutes} min`;
    }

    return `${Math.max(1, Math.floor(totalSeconds))} s`;
}

function safeText(element, text) {
    if (!element) return;
    element.textContent = text;
}

export default class StatisticsChartManager {
    constructor(quizUIInstance) {
        this.quizUI = quizUIInstance;
        this.store = null;
        this.actionOrchestrator = null;
        this.hasInitialized = false;
        this.previousStatsState = null;
        this.heatmapTooltip = null;

        this.elements = {
            statisticsCardEl: document.querySelector(".progression-card--analytics"),
            periodSelectEl: document.getElementById("stats-period-select"),
            insightsGridEl: document.getElementById("progression-insights-grid"),
            feedbackEl: document.getElementById("no-stats-data-message"),
            feedbackTextEl: document.querySelector("#no-stats-data-message [data-role='feedback-text']"),
            heatmapContainerEl: document.getElementById("chart-study-heatmap"),
            periodQuestionsEl: document.getElementById("metric-period-questions"),
            periodStudyTimeEl: document.getElementById("metric-period-study-time"),
            periodXpEl: document.getElementById("metric-period-xp"),
            periodStreakEl: document.getElementById("metric-period-streak"),
            trendCurrentEl: document.getElementById("trend-current-accuracy"),
            trendChangeEl: document.getElementById("trend-accuracy-change"),
            trendListEl: document.getElementById("trend-accuracy-list"),
            categoryBestListEl: document.getElementById("category-highlights-best"),
            categoryFocusListEl: document.getElementById("category-highlights-focus"),
            difficultyListEl: document.getElementById("difficulty-summary-list"),
            studyRhythmListEl: document.getElementById("study-rhythm-list"),
        };

        const initialPeriod = this.elements.periodSelectEl?.value;
        this.currentPeriod = this._normalizePeriodValue(initialPeriod);

        if (this.elements.periodSelectEl && this.elements.periodSelectEl.value !== this.currentPeriod) {
            const option = this.elements.periodSelectEl.querySelector(`option[value="${this.currentPeriod}"]`);
            if (option) {
                this.elements.periodSelectEl.value = this.currentPeriod;
            }
        }
    }

    _normalizePeriodValue(rawValue) {
        if (rawValue === undefined || rawValue === null) {
            return DEFAULT_PERIOD;
        }

        const normalized = String(rawValue).trim().toLowerCase();
        if (normalized === "all") {
            return "all";
        }

        const match = normalized.match(/^(\d+)(d)?$/);
        if (match) {
            const days = parseInt(match[1], 10);
            if (!Number.isNaN(days) && days > 0) {
                return `${days}d`;
            }
        }

        return DEFAULT_PERIOD;
    }

    setStore(storeInstance) {
        this.store = storeInstance;
        if (this.store) {
            this.store.subscribe(this.handleStateUpdate.bind(this));
        }
    }

    setActionOrchestrator(orchestrator) {
        this.actionOrchestrator = orchestrator;
    }

    init() {
        if (this.hasInitialized || !this.elements.periodSelectEl) {
            return;
        }

        this.elements.periodSelectEl.addEventListener("change", (event) => {
            const selectEl = event.target;
            const normalizedPeriod = this._normalizePeriodValue(selectEl.value);

            if (selectEl.value !== normalizedPeriod) {
                const option = selectEl.querySelector(`option[value="${normalizedPeriod}"]`);
                if (option) {
                    selectEl.value = normalizedPeriod;
                }
            }

            this.currentPeriod = normalizedPeriod;
            this._triggerFetchStatistics();
        });

        const currentStats = this.store?.getState().statistics;
        if (currentStats && !currentStats.data && !currentStats.isLoading) {
            this._triggerFetchStatistics();
        }

        this.hasInitialized = true;
    }

    _triggerFetchStatistics() {
        if (this.actionOrchestrator) {
            this.actionOrchestrator.fetchStatistics(this.currentPeriod);
        }
    }

    handleStateUpdate() {
        if (!this.store) return;
        const newStatsState = this.store.getState().statistics;

        if (JSON.stringify(newStatsState) !== JSON.stringify(this.previousStatsState)) {
            this._render(newStatsState);
            this.previousStatsState = newStatsState;
        }
    }

    _render(statsState) {
        if (!statsState) return;

        const { isLoading, data, error } = statsState;

        if (isLoading) {
            this._showLoadingPlaceholders();
            return;
        }

        this.elements.statisticsCardEl?.classList.remove("is-loading");

        if (error) {
            this._toggleInsightsVisibility(false);
            this._setFeedback(error, "error");
            return;
        }

        if (!data || data.status !== "success") {
            this._toggleInsightsVisibility(false);
            this._setFeedback("Não foi possível carregar suas estatísticas no momento.", "error");
            return;
        }

        const hasActivity = (data.key_metrics?.total_questions_answered ?? 0) > 0;

        if (!hasActivity) {
            this._toggleInsightsVisibility(false);
            this._setFeedback("Nenhuma estatística encontrada para o período selecionado. Complete um quiz para desbloquear o painel.", "empty");
            this._updatePeriodSummary(null);
            this._resetTrendInsights();
            this._resetCategoryHighlights();
            this._resetDifficultySummary();
            this._resetStudyRhythm();
            this._clearHeatmap();
            return;
        }

        this._toggleInsightsVisibility(true);
        this._hideFeedback();

        this._updatePeriodSummary(data.key_metrics);
        this._renderStudyHeatmapChart(data.study_heatmap);
        this._updateTrendInsights(data.learning_progress);
        this._updateCategoryHighlights(data.category_performance);
        this._updateDifficultySummary(data.difficulty_performance);
        this._updateStudyRhythm(data.study_time_detail);
    }

    _showLoadingPlaceholders() {
        this.elements.statisticsCardEl?.classList.add("is-loading");
        this._hideFeedback();
        this._toggleInsightsVisibility(true);

        safeText(this.elements.periodQuestionsEl, "--");
        safeText(this.elements.periodStudyTimeEl, "--");
        safeText(this.elements.periodXpEl, "--");
        safeText(this.elements.periodStreakEl, "--");
        safeText(this.elements.trendCurrentEl, "--");
        this._updateTrendBadge(null);

        this._setListLoadingState(this.elements.trendListEl, "trend-list__item trend-list__item--empty");
        this._setListLoadingState(this.elements.categoryBestListEl, "insight-list__item insight-list__item--empty");
        this._setListLoadingState(this.elements.categoryFocusListEl, "insight-list__item insight-list__item--empty");
        this._setListLoadingState(this.elements.difficultyListEl, "difficulty-list__item difficulty-list__item--empty");
        this._setListLoadingState(this.elements.studyRhythmListEl, "rhythm-list__item rhythm-list__item--empty");

        if (this.elements.heatmapContainerEl) {
            this.elements.heatmapContainerEl.innerHTML = '<p class="chart-placeholder">Carregando dados...</p>';
        }
    }

    _setListLoadingState(listEl, className = "trend-list__item trend-list__item--empty") {
        if (!listEl) return;
        listEl.innerHTML = "";
        const li = document.createElement("li");
        li.className = className;
        li.textContent = "Carregando...";
        listEl.appendChild(li);
    }

    _toggleInsightsVisibility(show) {
        if (!this.elements.insightsGridEl) return;
        if (show) {
            this.quizUI.showElement(this.elements.insightsGridEl);
        } else {
            this.quizUI.hideElement(this.elements.insightsGridEl);
        }
    }

    _setFeedback(message, type = "empty") {
        if (!this.elements.feedbackEl) return;

        this.elements.feedbackEl.classList.toggle("progression-feedback--error", type === "error");
        this.elements.feedbackEl.classList.toggle("progression-feedback--empty", type !== "error");
        safeText(this.elements.feedbackTextEl, message);
        this.quizUI.showElement(this.elements.feedbackEl);
    }

    _hideFeedback() {
        if (this.elements.feedbackEl) {
            this.quizUI.hideElement(this.elements.feedbackEl);
        }
    }

    _updatePeriodSummary(keyMetrics) {
        const metrics = keyMetrics || {};
        safeText(this.elements.periodQuestionsEl, formatNumber(metrics.total_questions_answered ?? 0));
        safeText(this.elements.periodStudyTimeEl, formatDuration(metrics.total_study_time_seconds));
        safeText(this.elements.periodXpEl, formatNumber(metrics.total_xp_period ?? 0));
        safeText(this.elements.periodStreakEl, formatNumber(metrics.max_streak ?? 0));
    }

    _resetTrendInsights() {
        safeText(this.elements.trendCurrentEl, "--");
        this._updateTrendBadge(null);
        if (this.elements.trendListEl) {
            this.elements.trendListEl.innerHTML = "";
            const li = document.createElement("li");
            li.className = "trend-list__item trend-list__item--empty";
            li.textContent = "Complete um quiz para visualizar o histórico de precisão.";
            this.elements.trendListEl.appendChild(li);
        }
    }

    _updateTrendInsights(data) {
        if (!this.elements.trendListEl) return;

        const validData = Array.isArray(data)
            ? data.filter((item) => item && typeof item.daily_accuracy === "number" && item.date_str)
            : [];

        if (validData.length === 0) {
            this._resetTrendInsights();
            return;
        }

        const lastEntry = validData[validData.length - 1];
        const firstEntry = validData[0];
        const change = lastEntry.daily_accuracy - firstEntry.daily_accuracy;

        safeText(this.elements.trendCurrentEl, `${lastEntry.daily_accuracy.toFixed(1)}%`);
        this._updateTrendBadge(change);

        const recentEntries = validData.slice(-7).reverse();
        this.elements.trendListEl.innerHTML = "";

        recentEntries.forEach((entry) => {
            const li = document.createElement("li");
            li.className = "trend-list__item";

            const dayLabel = document.createElement("span");
            dayLabel.className = "trend-list__day";
            dayLabel.textContent = this._formatDateLabel(entry.date_str);

            const value = document.createElement("span");
            value.className = "trend-list__value";
            value.textContent = `${entry.daily_accuracy.toFixed(1)}%`;

            li.append(dayLabel, value);
            this.elements.trendListEl.appendChild(li);
        });
    }

    _updateTrendBadge(changeValue) {
        const badgeEl = this.elements.trendChangeEl;
        if (!badgeEl) return;

        badgeEl.classList.remove("trend-badge--up", "trend-badge--down");

        if (changeValue === null || changeValue === undefined) {
            badgeEl.textContent = "--";
            return;
        }

        if (changeValue > 0) {
            badgeEl.classList.add("trend-badge--up");
            badgeEl.textContent = `+${changeValue.toFixed(1)} pts`;
        } else if (changeValue < 0) {
            badgeEl.classList.add("trend-badge--down");
            badgeEl.textContent = `${changeValue.toFixed(1)} pts`;
        } else {
            badgeEl.textContent = "Estável";
        }
    }

    _resetCategoryHighlights() {
        this._setEmptyCategoryState(this.elements.categoryBestListEl, "Sem dados suficientes.");
        this._setEmptyCategoryState(this.elements.categoryFocusListEl, "Sem dados suficientes.");
    }

    _updateCategoryHighlights(data) {
        const categories = Array.isArray(data) ? data : [];
        const bestList = this.elements.categoryBestListEl;
        const focusList = this.elements.categoryFocusListEl;

        if (!bestList || !focusList) return;

        if (categories.length === 0) {
            this._resetCategoryHighlights();
            return;
        }

        const sortedByAccuracyDesc = [...categories].sort((a, b) => (b.accuracy ?? 0) - (a.accuracy ?? 0));
        const sortedByAccuracyAsc = [...categories].sort((a, b) => (a.accuracy ?? 0) - (b.accuracy ?? 0));

        this._populateCategoryList(bestList, sortedByAccuracyDesc.slice(0, 3));
        this._populateCategoryList(focusList, sortedByAccuracyAsc.slice(0, 3));
    }

    _populateCategoryList(listEl, entries) {
        if (!listEl) return;
        listEl.innerHTML = "";

        if (!entries || entries.length === 0) {
            this._setEmptyCategoryState(listEl, "Sem dados suficientes.");
            return;
        }

        entries.forEach((entry) => {
            const li = document.createElement("li");
            li.className = "insight-list__item";

            const textWrapper = document.createElement("div");
            textWrapper.className = "insight-list__item-text";

            const label = document.createElement("span");
            label.className = "insight-list__item-label";
            label.textContent = entry.name || "Categoria";

            const hint = document.createElement("span");
            hint.className = "insight-list__hint";
            hint.textContent = `${entry.correct ?? 0} acertos de ${entry.total ?? 0}`;

            textWrapper.append(label, hint);

            const value = document.createElement("span");
            value.className = "insight-list__value";
            value.textContent = `${Math.round(entry.accuracy ?? 0)}%`;

            li.append(textWrapper, value);
            listEl.appendChild(li);
        });
    }

    _setEmptyCategoryState(listEl, message) {
        if (!listEl) return;
        listEl.innerHTML = "";
        const li = document.createElement("li");
        li.className = "insight-list__item insight-list__item--empty";
        li.textContent = message;
        listEl.appendChild(li);
    }

    _resetDifficultySummary() {
        this._setEmptyDifficultyState("Nenhuma sessão registrada no período.");
    }

    _updateDifficultySummary(data) {
        const listEl = this.elements.difficultyListEl;
        if (!listEl) return;

        const items = Array.isArray(data) ? data.filter((entry) => entry.total > 0) : [];

        if (items.length === 0) {
            this._resetDifficultySummary();
            return;
        }

        listEl.innerHTML = "";
        items.forEach((item) => {
            const li = document.createElement("li");
            li.className = "difficulty-list__item";

            const header = document.createElement("div");
            header.className = "difficulty-list__item-header";

            const label = document.createElement("span");
            label.className = "difficulty-list__item-label";
            label.textContent = item.name || "Dificuldade";

            const value = document.createElement("span");
            value.className = "difficulty-list__item-value";
            value.textContent = `${Math.round(item.accuracy ?? 0)}%`;

            header.append(label, value);

            const hint = document.createElement("span");
            hint.className = "insight-list__hint";
            hint.textContent = `${item.correct ?? 0} acertos em ${item.total ?? 0}`;

            const barContainer = document.createElement("div");
            barContainer.className = "difficulty-list__bar";
            const barFill = document.createElement("span");
            barFill.style.width = `${Math.min(100, Math.max(0, item.accuracy ?? 0))}%`;
            barContainer.appendChild(barFill);

            li.append(header, hint, barContainer);
            listEl.appendChild(li);
        });
    }

    _setEmptyDifficultyState(message) {
        const listEl = this.elements.difficultyListEl;
        if (!listEl) return;
        listEl.innerHTML = "";
        const li = document.createElement("li");
        li.className = "difficulty-list__item difficulty-list__item--empty";
        li.textContent = message;
        listEl.appendChild(li);
    }

    _resetStudyRhythm() {
        const listEl = this.elements.studyRhythmListEl;
        if (!listEl) return;
        listEl.innerHTML = "";
        const li = document.createElement("li");
        li.className = "rhythm-list__item rhythm-list__item--empty";
        li.textContent = "Ainda não há sessões suficientes para montar o ritmo.";
        listEl.appendChild(li);
    }

    _updateStudyRhythm(data) {
        const listEl = this.elements.studyRhythmListEl;
        if (!listEl) return;

        if (!data || !Array.isArray(data.labels) || !Array.isArray(data.data) || data.labels.length === 0) {
            this._resetStudyRhythm();
            return;
        }

        const values = data.data.map((value) => Number(value) || 0);
        const maxValue = Math.max(...values, 0);

        listEl.innerHTML = "";
        data.labels.forEach((label, index) => {
            const amount = values[index];
            const li = document.createElement("li");
            li.className = "rhythm-list__item";

            const day = document.createElement("span");
            day.className = "rhythm-list__item-label";
            day.textContent = label;

            const barContainer = document.createElement("div");
            barContainer.className = "rhythm-list__item-bar";
            const barFill = document.createElement("span");
            const widthPercentage = maxValue > 0 ? Math.max(6, (amount / maxValue) * 100) : 6;
            barFill.style.width = `${Math.min(100, widthPercentage)}%`;
            barContainer.appendChild(barFill);

            const valueLabel = document.createElement("span");
            valueLabel.className = "rhythm-list__item-value";
            valueLabel.textContent = `${amount} min`;

            li.append(day, barContainer, valueLabel);
            listEl.appendChild(li);
        });
    }

    _renderStudyHeatmapChart(data) {
        const container = this.elements.heatmapContainerEl;
        if (!container) return;

        container.innerHTML = "";

        if (!Array.isArray(data) || data.length === 0) {
            this._showNoDataMessageForHeatmap("Sem dados de frequência para exibir.");
            return;
        }

        this._createTooltip();
        const dataMap = new Map(data.map((entry) => [entry.date_str, entry.questions_done]));

        const today = new Date();
        const currentYear = today.getUTCFullYear();
        const startDate = new Date(Date.UTC(currentYear, 0, 1));
        const endDate = new Date(Date.UTC(currentYear, 11, 31));

        const heatmapContainer = document.createElement("div");
        heatmapContainer.className = "heatmap-container";

        const grid = document.createElement("div");
        grid.className = "heatmap-grid";

        const graphData = this._generateGraphElements(startDate, endDate, dataMap);

        grid.appendChild(graphData.daysOfWeek);
        grid.appendChild(graphData.months);
        grid.appendChild(graphData.graph);

        heatmapContainer.appendChild(grid);
        heatmapContainer.appendChild(this._createLegend());
        container.appendChild(heatmapContainer);
    }

    _showNoDataMessageForHeatmap(message) {
        if (!this.elements.heatmapContainerEl) return;
        this.elements.heatmapContainerEl.innerHTML = "";
        const placeholder = document.createElement("p");
        placeholder.className = "chart-placeholder";
        placeholder.textContent = message;
        this.elements.heatmapContainerEl.appendChild(placeholder);
    }

    _clearHeatmap() {
        if (this.elements.heatmapContainerEl) {
            this.elements.heatmapContainerEl.innerHTML = "";
        }
    }

    _generateGraphElements(startDate, endDate, dataMap) {
        const graph = document.createElement("div");
        graph.className = "heatmap-graph";

        const monthsContainer = document.createElement("div");
        monthsContainer.className = "heatmap-months";

        const daysContainer = document.createElement("div");
        daysContainer.className = "heatmap-days-of-week";
        ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].forEach((day) => {
            const div = document.createElement("div");
            div.textContent = day;
            daysContainer.appendChild(div);
        });

        let currentDate = new Date(startDate);
        const firstDayOfWeek = startDate.getUTCDay();

        for (let i = 0; i < firstDayOfWeek; i += 1) {
            const emptyDay = document.createElement("div");
            emptyDay.className = "heatmap-day";
            emptyDay.style.visibility = "hidden";
            graph.appendChild(emptyDay);
        }

        const monthLabels = [];
        const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
        let lastMonth = -1;
        let weekCount = 1;

        while (currentDate <= endDate) {
            const dateStr = currentDate.toISOString().split("T")[0];
            const count = dataMap.get(dateStr) || 0;
            const level = this._getContributionLevel(count);

            const dayEl = document.createElement("div");
            dayEl.className = "heatmap-day";
            dayEl.dataset.level = level.toString();
            dayEl.dataset.date = dateStr;
            dayEl.dataset.count = count.toString();
            this._addTooltipEvents(dayEl);
            graph.appendChild(dayEl);

            const currentMonth = currentDate.getUTCMonth();
            if (currentMonth !== lastMonth) {
                monthLabels.push({ name: monthNames[currentMonth], startColumn: weekCount });
                lastMonth = currentMonth;
            }

            if (currentDate.getUTCDay() === 6) {
                weekCount += 1;
            }

            currentDate.setUTCDate(currentDate.getUTCDate() + 1);
        }

        monthLabels.forEach((label) => {
            const monthEl = document.createElement("div");
            monthEl.className = "heatmap-month-label";
            monthEl.textContent = label.name;
            monthEl.style.gridColumnStart = label.startColumn;
            monthsContainer.appendChild(monthEl);
        });

        return { graph, months: monthsContainer, daysOfWeek: daysContainer };
    }

    _getContributionLevel(count) {
        if (count >= 20) return 4;
        if (count >= 10) return 3;
        if (count >= 5) return 2;
        if (count > 0) return 1;
        return 0;
    }

    _createTooltip() {
        if (this.heatmapTooltip) return;
        this.heatmapTooltip = document.createElement("div");
        this.heatmapTooltip.className = "heatmap-tooltip";
        document.body.appendChild(this.heatmapTooltip);
    }

    _addTooltipEvents(element) {
        element.addEventListener("mouseover", (event) => {
            const count = event.target.dataset.count;
            const dateStr = event.target.dataset.date;
            const formattedDate = this._formatTooltipDate(dateStr);
            this.heatmapTooltip.innerHTML = `<strong>${count} questão${count === "1" ? "" : "s"}</strong><span>${formattedDate}</span>`;
            this.heatmapTooltip.classList.add("is-visible");
        });

        element.addEventListener("mousemove", (event) => {
            const tooltipWidth = this.heatmapTooltip.offsetWidth;
            const tooltipHeight = this.heatmapTooltip.offsetHeight;
            const offset = 14;
            this.heatmapTooltip.style.left = `${event.pageX - tooltipWidth / 2}px`;
            this.heatmapTooltip.style.top = `${event.pageY - tooltipHeight - offset}px`;
        });

        element.addEventListener("mouseleave", () => {
            this.heatmapTooltip.classList.remove("is-visible");
        });
    }

    _createLegend() {
        const legend = document.createElement("div");
        legend.className = "heatmap-legend";

        const label = document.createElement("span");
        label.textContent = "Menos";

        const list = document.createElement("ul");
        for (let level = 0; level <= 4; level += 1) {
            const item = document.createElement("li");
            item.dataset.level = level;
            list.appendChild(item);
        }

        const labelMax = document.createElement("span");
        labelMax.textContent = "Mais";

        legend.append(label, list, labelMax);
        return legend;
    }

    _formatTooltipDate(dateStr) {
        if (!dateStr) return "";
        const date = new Date(`${dateStr}T00:00:00Z`);
        return date.toLocaleDateString("pt-BR", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
            timeZone: "UTC",
        });
    }

    _formatDateLabel(dateStr) {
        if (!dateStr) return "";
        const date = new Date(`${dateStr}T00:00:00Z`);
        return date.toLocaleDateString("pt-BR", {
            day: "2-digit",
            month: "short",
            timeZone: "UTC",
        });
    }
}
