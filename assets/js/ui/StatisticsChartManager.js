// assets/js/ui/StatisticsChartManager.js

import { API_URLS } from '../utils/constants.js';

export default class StatisticsChartManager {
    constructor(quizUIInstance, apiServiceInstance) {
        this.quizUI = quizUIInstance;
        this.apiService = apiServiceInstance;
        // console.log("StatisticsChartManager constructor: apiServiceInstance received:", this.apiService); // DEBUG
        if (!this.apiService) {
            console.error("CRITICAL: StatisticsChartManager constructor did NOT receive a valid apiServiceInstance! Charts will not work.");
        }

        this.elements = {
            overallAccuracyChartEl: document.getElementById('chart-overall-accuracy'),
            categoryPerformanceChartEl: document.getElementById('chart-category-performance'),
            learningProgressChartEl: document.getElementById('chart-learning-progress'),
            studyHeatmapChartEl: document.getElementById('chart-study-heatmap'),
            studyTimeChartEl: document.getElementById('chart-study-time'),
            difficultyPerformanceChartEl: document.getElementById('chart-difficulty-performance'),
            periodSelectEl: document.getElementById('stats-period-select'),
            totalQuestionsEl: document.getElementById('metric-total-questions'),
            maxStreakEl: document.getElementById('metric-max-streak'),
            totalScoreEl: document.getElementById('metric-total-score'),
            totalStudyTimeEl: document.getElementById('metric-total-study-time'),
            noStatsDataMessageEl: document.getElementById('no-stats-data-message'),
            statisticsDashboardContainer: document.querySelector('.statistics-dashboard'),
        };
        this.charts = {
            overallAccuracy: null,
            categoryPerformance: null,
            learningProgress: null,
            studyHeatmap: null,
            studyTime: null,
            difficultyPerformance: null,
        };
        this.isLoading = false;
        this.currentPeriod = this.elements.periodSelectEl ? this.elements.periodSelectEl.value : '30d';
        this.hasInitialized = false;
    }

    init() {
        if (!this.elements.periodSelectEl) {
            // console.warn("StatisticsChartManager.init: Elemento de seleção de período não encontrado.");
        }

        if (!this.hasInitialized && this.elements.periodSelectEl) {
            this.elements.periodSelectEl.addEventListener('change', (event) => {
                this.currentPeriod = event.target.value;
                this.loadAndRenderAllCharts();
            });
            this.hasInitialized = true;
        }
        
        this.loadAndRenderAllCharts();
    }

    _showLoadingPlaceholders() {
        this.elements.statisticsDashboardContainer?.classList.add('is-loading');
        document.querySelectorAll('.chart-container .chart-placeholder').forEach(p => {
            p.textContent = 'Carregando gráfico...';
            p.style.color = 'var(--color-text-muted)';
            this.quizUI.showElement(p);
        });

        Object.keys(this.charts).forEach(chartKey => this._destroyChart(chartKey));

        if (this.elements.noStatsDataMessageEl) {
            this.quizUI.hideElement(this.elements.noStatsDataMessageEl);
        }
    }

    _hideLoadingPlaceholder(chartEl) {
        const placeholder = chartEl?.querySelector('.chart-placeholder');
        if (placeholder) this.quizUI.hideElement(placeholder);
    }

    _showNoDataMessageForChart(chartEl, message = "Sem dados para este gráfico.") {
        this._hideLoadingPlaceholder(chartEl);
        const placeholder = chartEl?.querySelector('.chart-placeholder');
        if (placeholder) {
            placeholder.textContent = message;
            placeholder.style.color = 'var(--color-text-muted)';
            this.quizUI.showElement(placeholder);
        }
    }

    async loadAndRenderAllCharts() {
        if (this.isLoading) {
            return;
        }
        this.isLoading = true;
        this._showLoadingPlaceholders();
        // console.log("StatisticsChartManager.loadAndRenderAllCharts: Attempting to fetch stats. this.apiService is now:", this.apiService);

        if (!this.apiService || typeof this.apiService.fetchUserStatistics !== 'function') { //
            console.error("CRITICAL: StatisticsChartManager - this.apiService is invalid or fetchUserStatistics is not a function.", this.apiService);
            this.isLoading = false;
            this.elements.statisticsDashboardContainer?.classList.remove('is-loading');
            const errorMsg = "Erro de configuração interna: Serviço API não disponível.";
            document.querySelectorAll('.chart-container .chart-placeholder').forEach(p => {
                p.textContent = errorMsg; p.style.color = 'var(--color-accent-red)'; this.quizUI.showElement(p);
            });
            if (this.elements.noStatsDataMessageEl) {
                this.elements.noStatsDataMessageEl.textContent = errorMsg;
                this.elements.noStatsDataMessageEl.style.color = 'var(--color-accent-red)';
                this.quizUI.showElement(this.elements.noStatsDataMessageEl);
            }
            this._updateKeyMetrics(null);
            return;
        }

        try {
            const statsData = await this.apiService.fetchUserStatistics(this.currentPeriod);

            if (statsData && statsData.status === 'success') {
                this._updateKeyMetrics(statsData.key_metrics);
                const hasAnyChartData = 
                    (statsData.overall_accuracy && (statsData.overall_accuracy.correct > 0 || statsData.overall_accuracy.incorrect > 0)) ||
                    (statsData.category_performance && statsData.category_performance.length > 0) ||
                    (statsData.learning_progress && statsData.learning_progress.length > 0) ||
                    (statsData.study_heatmap && statsData.study_heatmap.length > 0) ||
                    (statsData.study_time_detail && statsData.study_time_detail.data.some(d => d > 0)) ||
                    (statsData.difficulty_performance && statsData.difficulty_performance.some(d => d.total > 0));

                if (!hasAnyChartData && statsData.key_metrics?.total_questions_answered === 0) {
                    if (this.elements.noStatsDataMessageEl) this.quizUI.showElement(this.elements.noStatsDataMessageEl);
                    document.querySelectorAll('.chart-container .chart-placeholder').forEach(p => {
                         this._showNoDataMessageForChart(p.parentElement, "Sem dados para o período.");
                    });
                } else {
                    if (this.elements.noStatsDataMessageEl) this.quizUI.hideElement(this.elements.noStatsDataMessageEl);
                    this._renderOverallAccuracyChart(statsData.overall_accuracy);
                    this._renderCategoryPerformanceChart(statsData.category_performance);
                    this._renderLearningProgressChart(statsData.learning_progress);
                    this._renderStudyHeatmapChart(statsData.study_heatmap);
                    this._renderStudyTimeChart(statsData.study_time_detail);
                    this._renderDifficultyPerformanceChart(statsData.difficulty_performance);
                }
            } else {
                throw new Error(statsData?.message || 'Falha ao carregar estatísticas do servidor.');
            }
        } catch (error) {
            console.error("StatisticsChartManager: Erro ao carregar ou renderizar gráficos:", error);
            const userMessage = (this.quizUI._getFriendlyErrorMessage && typeof this.quizUI._getFriendlyErrorMessage === 'function')
                ? this.quizUI._getFriendlyErrorMessage(error, "Não foi possível carregar suas estatísticas.")
                : "Não foi possível carregar suas estatísticas. Tente novamente mais tarde.";
            
            document.querySelectorAll('.chart-container').forEach(container => {
                const placeholder = container.querySelector('.chart-placeholder');
                if (placeholder) {
                    placeholder.textContent = userMessage; placeholder.style.color = 'var(--color-accent-red)'; this.quizUI.showElement(placeholder);
                }
            });
            if (this.elements.noStatsDataMessageEl) {
                this.elements.noStatsDataMessageEl.textContent = userMessage; this.elements.noStatsDataMessageEl.style.color = 'var(--color-accent-red)'; this.quizUI.showElement(this.elements.noStatsDataMessageEl);
            }
            this._updateKeyMetrics(null);
        } finally {
            this.isLoading = false;
            this.elements.statisticsDashboardContainer?.classList.remove('is-loading');
        }
    }

    _updateKeyMetrics(keyMetrics) {
        const metrics = keyMetrics || {
            total_questions_answered: 0, max_streak: 0,
            total_score_all_time: 0, total_study_time_seconds: 0,
        };
        if (this.elements.totalQuestionsEl) this.elements.totalQuestionsEl.textContent = metrics.total_questions_answered.toLocaleString('pt-BR');
        if (this.elements.maxStreakEl) this.elements.maxStreakEl.textContent = metrics.max_streak.toLocaleString('pt-BR');
        if (this.elements.totalScoreEl) this.elements.totalScoreEl.textContent = metrics.total_score_all_time.toLocaleString('pt-BR');
        if (this.elements.totalStudyTimeEl) {
            const totalSeconds = metrics.total_study_time_seconds || 0;
            const minutes = Math.floor(totalSeconds / 60);
            const hours = Math.floor(minutes / 60);
            const remainingMinutes = minutes % 60;
            this.elements.totalStudyTimeEl.textContent = hours > 0 ? `${hours}h ${remainingMinutes}m` : `${minutes}m`;
        }
    }

    _destroyChart(chartKey) {
        if (this.charts[chartKey] && typeof this.charts[chartKey].destroy === 'function') {
            try {
                this.charts[chartKey].destroy();
            } catch (e) {
                // console.warn(`StatisticsChartManager: Error destroying chart ${chartKey}:`, e);
            }
        }
        this.charts[chartKey] = null;
    }

    _getChartDefaultOptions(extraOptions = {}) {
        return {
            chart: {
                fontFamily: 'var(--font-family-sans)',
                foreColor: 'var(--color-text-secondary)',
                toolbar: { show: true, tools: { download: true, selection: false, zoom: false, zoomin: false, zoomout: false, pan: false, reset: true } },
                animations: { enabled: true, easing: 'easeinout', speed: 600, },
                ...extraOptions.chart
            },
            grid: {
                borderColor: 'var(--color-gray-200)',
                row: { colors: ['transparent', 'transparent'], opacity: 0.5 },
                xaxis: { lines: { show: false } },
                yaxis: { lines: { show: true } },
            },
            stroke: { width: 2, curve: 'smooth' },
            markers: { size: 4, hover: { sizeOffset: 2 } },
            tooltip: {
                theme: 'light', 
                style: { fontSize: '12px', fontFamily: 'var(--font-family-sans)' },
                x: { format: 'dd MMM yy' } 
            },
            legend: {
                position: 'bottom', horizontalAlign: 'center', fontSize: '12px',
                fontFamily: 'var(--font-family-sans)', fontWeight: 500, offsetY: 5,
                itemMargin: { horizontal: 10, vertical: 2 },
            },
            noData: { 
                text: 'Sem dados para exibir neste gráfico.', align: 'center', verticalAlign: 'middle',
                style: { color: 'var(--color-text-muted)', fontSize: '14px', fontFamily: 'var(--font-family-sans)'}
            },
            ...extraOptions 
        };
    }

    _renderOverallAccuracyChart(data) {
        this._destroyChart('overallAccuracy');
        if (!this.elements.overallAccuracyChartEl || !data || (data.correct === 0 && data.incorrect === 0)) {
            this._showNoDataMessageForChart(this.elements.overallAccuracyChartEl, "Sem dados de precisão.");
            return;
        }
        this._hideLoadingPlaceholder(this.elements.overallAccuracyChartEl);

        const chartOptions = this._getChartDefaultOptions({
            chart: { type: 'donut', height: 300 },
            series: [data.correct, data.incorrect],
            labels: ['Acertos', 'Erros'],
            colors: ['var(--color-secondary-green)', 'var(--color-accent-red)'],
            plotOptions: { pie: { donut: { size: '65%', labels: {
                show: true, name: { show: false },
                value: { show: true, fontSize: '20px', fontFamily: 'var(--font-family-heading)', fontWeight: 600, color: 'var(--color-text-primary)', offsetY: 8,
                    formatter: (val, { seriesIndex, w }) => {
                        const total = w.globals.seriesTotals.reduce((a, b) => a + b, 0);
                        return total > 0 ? (w.globals.series[seriesIndex] / total * 100).toFixed(0) + '%' : '0%';
                    }
                },
                total: { show: true, showAlways: false, label: 'Total', fontSize: '12px', fontFamily: 'var(--font-family-sans)', fontWeight: 500, color: 'var(--color-text-secondary)',
                    formatter: (w) => w.globals.seriesTotals.reduce((a, b) => a + b, 0).toLocaleString('pt-BR')
                }
            }}}},
            responsive: [{ breakpoint: 480, options: { chart: { height: 260 }, legend: { position: 'bottom', fontSize: '11px' } } }],
            tooltip: { y: { formatter: (val) => val.toLocaleString('pt-BR') + " questões" } }
        });
        this.charts.overallAccuracy = new ApexCharts(this.elements.overallAccuracyChartEl, chartOptions);
        this.charts.overallAccuracy.render();
    }

    _renderCategoryPerformanceChart(data) {
        this._destroyChart('categoryPerformance');
        if (!this.elements.categoryPerformanceChartEl || !data || data.length === 0) {
            this._showNoDataMessageForChart(this.elements.categoryPerformanceChartEl, "Sem dados de categoria.");
            return;
        }
        this._hideLoadingPlaceholder(this.elements.categoryPerformanceChartEl);

        const topData = data.slice(0, 7);
        const categories = topData.map(item => item.name.length > 20 ? item.name.substring(0, 18) + '...' : item.name);
        const accuracies = topData.map(item => parseFloat(item.accuracy.toFixed(1)));

        const chartOptions = this._getChartDefaultOptions({
            chart: { type: 'bar', height: 350 },
            series: [{ name: 'Precisão', data: accuracies }],
            xaxis: { categories: categories, labels: { style: { fontSize: '11px', colors: 'var(--color-text-secondary)' }, rotate: -30, trim: true, maxHeight: 80, hideOverlappingLabels: true } },
            yaxis: { min: 0, max: 100, tickAmount: 5, labels: { formatter: (val) => val + "%", style: { fontSize: '11px'} } },
            colors: ['var(--color-primary-medium)'],
            plotOptions: { bar: { horizontal: false, columnWidth: '60%', borderRadius: 4 } },
            dataLabels: { enabled: true, formatter: (val) => val + "%", style: { fontSize: '10px', colors: ['#fff'] }, offsetY: -20 },
            tooltip: { y: { formatter: (val) => val.toFixed(1) + "%" } }
        });
        this.charts.categoryPerformance = new ApexCharts(this.elements.categoryPerformanceChartEl, chartOptions);
        this.charts.categoryPerformance.render();
    }

    _renderLearningProgressChart(data) {
        this._destroyChart('learningProgress');
         if (!this.elements.learningProgressChartEl || !data || data.length < 2) {
            this._showNoDataMessageForChart(this.elements.learningProgressChartEl, "Dados insuficientes para progresso.");
            return;
        }
        this._hideLoadingPlaceholder(this.elements.learningProgressChartEl);

        const seriesData = data.map(item => ({ x: new Date(item.date_str).getTime(), y: item.daily_accuracy }));

        const chartOptions = this._getChartDefaultOptions({
            chart: { type: 'area', height: 350, zoom: { enabled: false } },
            series: [{ name: 'Precisão Diária', data: seriesData }],
            xaxis: { type: 'datetime', labels: { datetimeUTC: false, format: 'dd MMM yy', style: { fontSize: '11px'} } },
            yaxis: { min: 0, max: 100, tickAmount: 5, labels: { formatter: (val) => val.toFixed(0) + "%", style: { fontSize: '11px'} } },
            colors: ['var(--color-secondary-green)'],
            fill: { type: "gradient", gradient: { shadeIntensity: 1, opacityFrom: 0.7, opacityTo: 0.1, stops: [0, 90, 100] } },
            tooltip: { 
                x: { format: 'dd MMM yyyy' }, // Concluindo a linha que foi cortada
                y: { formatter: (val) => val.toFixed(1) + "%" } 
            },
            dataLabels: { enabled: false }
        });
        this.charts.learningProgress = new ApexCharts(this.elements.learningProgressChartEl, chartOptions);
        this.charts.learningProgress.render();
    }

    _renderStudyHeatmapChart(data) {
        this._destroyChart('studyHeatmap');
        if (!this.elements.studyHeatmapChartEl || !data || data.length === 0) {
            this._showNoDataMessageForChart(this.elements.studyHeatmapChartEl, "Sem dados de frequência.");
            return;
        }
        this._hideLoadingPlaceholder(this.elements.studyHeatmapChartEl);
    
        const activityData = data.map(item => ({ x: new Date(item.date_str).getTime(), y: item.questions_done }));
        if (activityData.length === 0) {
            this._showNoDataMessageForChart(this.elements.studyHeatmapChartEl, "Sem dados de frequência.");
            return;
        }

        const chartOptions = this._getChartDefaultOptions({
            chart: { type: 'bar', height: 350, stacked: true },
            series: [{ name: 'Questões Respondidas', data: activityData }],
            xaxis: {
                type: 'datetime',
                labels: { datetimeUTC: false, format: 'dd MMM', style: { fontSize: '10px' } },
                title: { text: 'Data', style: { fontSize: '11px', fontWeight: 500 } }
            },
            yaxis: { title: { text: 'Nº de Questões', style: { fontSize: '11px', fontWeight: 500 } }, labels: {style: {fontSize: '11px'}}},
            colors: ['var(--color-primary-medium)'],
            plotOptions: { bar: { columnWidth: '70%', borderRadius: 4 } },
            tooltip: { x: { format: 'dd MMM yyyy' }, y: { formatter: (val) => val.toLocaleString('pt-BR') + " questões" }},
            dataLabels: { enabled: false }
        });
        this.charts.studyHeatmap = new ApexCharts(this.elements.studyHeatmapChartEl, chartOptions);
        this.charts.studyHeatmap.render();
    }

    _renderStudyTimeChart(data) {
        this._destroyChart('studyTime');
        if (!this.elements.studyTimeChartEl || !data || data.data.every(d => d === 0)) {
           this._showNoDataMessageForChart(this.elements.studyTimeChartEl, "Sem dados de tempo de estudo.");
            return;
        }
        this._hideLoadingPlaceholder(this.elements.studyTimeChartEl);

        const chartOptions = this._getChartDefaultOptions({
            chart: { type: 'bar', height: 300 },
            series: [{ name: 'Minutos de Estudo', data: data.data }],
            xaxis: { categories: data.labels, labels: { style: { fontSize: '11px', colors: 'var(--color-text-secondary)'} } },
            yaxis: { title: { text: 'Minutos', style: { fontSize: '11px', fontWeight: 500, color: 'var(--color-text-secondary)'} }, labels: { style: { fontSize: '11px'} } },
            colors: ['var(--color-primary-dark)'],
            plotOptions: { bar: { borderRadius: 4, horizontal: false, columnWidth: '45%' } },
            dataLabels: { enabled: true, formatter: (val) => val > 0 ? val + "m" : "", style: { fontSize: '10px', colors: ["#fff"] }, offsetY: -18 },
            tooltip: { y: { formatter: (val) => val + " min" } }
        });
        this.charts.studyTime = new ApexCharts(this.elements.studyTimeChartEl, chartOptions);
        this.charts.studyTime.render();
    }

    _renderDifficultyPerformanceChart(data) {
        this._destroyChart('difficultyPerformance');
        if (!this.elements.difficultyPerformanceChartEl || !data || data.length === 0 || data.every(d => d.total === 0)) {
            this._showNoDataMessageForChart(this.elements.difficultyPerformanceChartEl, "Sem dados de dificuldade.");
            return;
        }
        this._hideLoadingPlaceholder(this.elements.difficultyPerformanceChartEl);

        const difficulties = data.map(item => item.name);
        const accuracies = data.map(item => parseFloat(item.accuracy.toFixed(1)));

        const chartOptions = this._getChartDefaultOptions({
            chart: { type: 'bar', height: 320 },
            series: [{ name: 'Precisão', data: accuracies }],
            xaxis: { categories: difficulties, labels: { style: { fontSize: '11px', colors: 'var(--color-text-secondary)'} } },
            yaxis: { min: 0, max: 100, tickAmount: 5, labels: { formatter: (val) => val + "%", style: { fontSize: '11px'} } },
            colors: ['var(--color-secondary-green)'],
            plotOptions: { bar: { horizontal: true, barHeight: '60%', borderRadius: 4 } },
            dataLabels: { 
                enabled: true, 
                formatter: (val) => val > 0 ? val.toFixed(0) + "%" : "",
                style: { fontSize: '10px', colors: ['var(--color-text-primary)'] },
                offsetX: -22, 
                dropShadow: { enabled: true, top: 1, left: 1, blur: 1, color: '#fff', opacity: 0.6 }
            },
            tooltip: { y: { formatter: (val) => val.toFixed(1) + "%" } }
        });
        this.charts.difficultyPerformance = new ApexCharts(this.elements.difficultyPerformanceChartEl, chartOptions);
        this.charts.difficultyPerformance.render();
    }
}