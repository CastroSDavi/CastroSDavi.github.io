// assets/js/ui/StatisticsChartManager.js

import { API_URLS } from '../utils/constants.js';

export default class StatisticsChartManager {
    constructor(quizUIInstance, apiServiceInstance) {
        this.quizUI = quizUIInstance;
        this.apiService = apiServiceInstance;
        
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

        if (!this.apiService || typeof this.apiService.fetchUserStatistics !== 'function') { 
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
        const bodyStyles = getComputedStyle(document.body);
        const fontFamily = bodyStyles.getPropertyValue('--font-family-sans').trim() || 'Roboto, sans-serif';
        const headingFontFamily = bodyStyles.getPropertyValue('--font-family-heading').trim() || 'Montserrat, sans-serif';
        const textColor = bodyStyles.getPropertyValue('--color-text-secondary').trim() || '#6c757d';
        const textPrimaryColor = bodyStyles.getPropertyValue('--color-text-primary').trim() || '#343a40';
        const gridBorderColor = bodyStyles.getPropertyValue('--color-gray-200').trim() || '#f1f3f5';

        return {
            chart: {
                fontFamily: fontFamily,
                foreColor: textColor,
                toolbar: { 
                    show: true, 
                    tools: { 
                        download: true, 
                        selection: false, zoom: false, zoomin: false, zoomout: false, pan: false, 
                        reset: true 
                    },
                    autoSelected: 'zoom' 
                },
                animations: { 
                    enabled: true, 
                    easing: 'easeinout', 
                    speed: 600, 
                    animateGradually: { enabled: true, delay: 150 },
                    dynamicAnimation: { enabled: true, speed: 350 }
                },
                dropShadow: { 
                    enabled: false, 
                    top: 3,
                    left: 2,
                    blur: 4,
                    opacity: 0.1,
                    color: '#000'
                },
                ...extraOptions.chart
            },
            grid: {
                borderColor: gridBorderColor,
                strokeDashArray: 4, 
                row: { colors: ['transparent', 'transparent'], opacity: 0.5 },
                xaxis: { lines: { show: false } }, 
                yaxis: { lines: { show: true } }, 
                padding: { 
                    left: 5,
                    right: 10,
                    top: 0,
                    bottom: 0
                }
            },
            stroke: { 
                width: 2.5, 
                curve: 'smooth' 
            },
            markers: { 
                size: 0, 
                hover: { size: 5, sizeOffset: 2 } 
            },
            tooltip: {
                theme: 'light', 
                style: { 
                    fontSize: '12px', 
                    fontFamily: fontFamily
                },
                x: { format: 'dd MMM yy' },
                marker: { 
                    show: true,
                },
                y: { 
                    formatter: function (val) {
                        return val !== undefined && val !== null ? val.toLocaleString('pt-BR') : "";
                    },
                    title: {
                        formatter: (seriesName) => seriesName ? seriesName + ': ' : '',
                    }
                }
            },
            legend: {
                fontFamily: fontFamily,
                fontWeight: 500, 
                fontSize: '12px',
                offsetY: 5,
                itemMargin: { horizontal: 10, vertical: 3 },
                markers: { 
                    width: 10,
                    height: 10,
                    radius: 5,
                    offsetY: 1
                },
                ...extraOptions.legend 
            },
            noData: { 
                text: 'Sem dados para exibir neste gráfico.', 
                align: 'center', verticalAlign: 'middle',
                style: { 
                    color: textColor, 
                    fontSize: '14px', 
                    fontFamily: fontFamily
                }
            },
            colors: [
                bodyStyles.getPropertyValue('--color-primary-medium').trim() || '#1a5f9e',
                bodyStyles.getPropertyValue('--color-secondary-green').trim() || '#2a9d8f',
                bodyStyles.getPropertyValue('--color-accent-red').trim() || '#e63946',
                bodyStyles.getPropertyValue('--color-accent-yellow').trim() || '#FCA5A5', // Usando yellow como fallback
                '#6366F1', 
                '#FDBA74'  
            ],
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

        const bodyStyles = getComputedStyle(document.body);
        const headingFontFamily = bodyStyles.getPropertyValue('--font-family-heading').trim();
        const textPrimaryColor = bodyStyles.getPropertyValue('--color-text-primary').trim();
        const textColorSecondary = bodyStyles.getPropertyValue('--color-text-secondary').trim();

        const chartOptions = this._getChartDefaultOptions({
            chart: { type: 'donut', height: 280 },
            series: [data.correct, data.incorrect],
            labels: ['Acertos', 'Erros'],
            colors: [
                bodyStyles.getPropertyValue('--color-secondary-green').trim(), 
                bodyStyles.getPropertyValue('--color-accent-red').trim()
            ],
            plotOptions: { 
                pie: { 
                    donut: { 
                        size: '70%', 
                        labels: {
                            show: true, 
                            name: { 
                                show: true, 
                                fontSize: '13px',
                                fontFamily: headingFontFamily,
                                fontWeight: 500,
                                color: textColorSecondary,
                                offsetY: -5
                            },
                            value: { 
                                show: true, 
                                fontSize: '22px', 
                                fontFamily: headingFontFamily, 
                                fontWeight: 700, 
                                color: textPrimaryColor, 
                                offsetY: 5,
                                formatter: (val, { seriesIndex, w }) => {
                                    const total = w.globals.seriesTotals.reduce((a, b) => a + b, 0);
                                    return total > 0 ? (w.globals.series[seriesIndex] / total * 100).toFixed(0) + '%' : '0%';
                                }
                            },
                            total: { 
                                show: true, 
                                showAlways: true, 
                                label: 'Total', 
                                fontSize: '12px', 
                                fontFamily: bodyStyles.getPropertyValue('--font-family-sans').trim(), 
                                fontWeight: 500, 
                                color: textColorSecondary,
                                formatter: (w) => w.globals.seriesTotals.reduce((a, b) => a + b, 0).toLocaleString('pt-BR')
                            }
                        }
                    }
                }
            },
            legend: { 
                position: 'bottom',
                fontSize: '12px',
                offsetY: 0,
                itemMargin: { horizontal: 8, vertical: 2 },
                markers: { width: 9, height: 9, radius: 4, offsetY: 1}
            },
            dataLabels: { 
                enabled: false,
                formatter: function (val, opts) {
                    return opts.w.globals.labels[opts.seriesIndex] + ":  " + val.toFixed(0) + "%"
                },
                style: {
                    fontSize: '12px',
                    colors: [textPrimaryColor]
                },
                dropShadow: {
                    enabled: true, top: 1, left: 1, blur: 1, color: '#fff', opacity: 0.7
                }
            },
            tooltip: { 
                y: { 
                    formatter: (val) => val.toLocaleString('pt-BR') + " questões",
                    title: { formatter: (seriesName) => seriesName + ':' }
                } 
            },
            responsive: [{ 
                breakpoint: 480, 
                options: { 
                    chart: { height: 250 }, 
                    plotOptions: { pie: { donut: { size: '65%' } } },
                    legend: { fontSize: '11px', itemMargin: { horizontal: 6 } } 
                } 
            }],
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

        const bodyStyles = getComputedStyle(document.body);
        const topData = data.slice(0, 7); 
        const categories = topData.map(item => item.name.length > 18 ? item.name.substring(0, 16) + '...' : item.name);
        const accuracies = topData.map(item => parseFloat(item.accuracy.toFixed(1)));

        const chartOptions = this._getChartDefaultOptions({
            chart: { type: 'bar', height: 330, dropShadow: { enabled: true, top: 5, left: 0, blur: 3, opacity: 0.1 } },
            series: [{ name: 'Precisão', data: accuracies }],
            xaxis: { 
                categories: categories, 
                labels: { 
                    style: { 
                        fontSize: '11px', 
                        colors: bodyStyles.getPropertyValue('--color-text-secondary').trim()
                    }, 
                    rotate: -35, 
                    trim: true, 
                    maxHeight: 70, 
                    hideOverlappingLabels: true,
                    offsetX: -2,
                    offsetY: 2
                } 
            },
            yaxis: { 
                min: 0, max: 100, tickAmount: 5, 
                labels: { 
                    formatter: (val) => val.toFixed(0) + "%", 
                    style: { fontSize: '11px'} 
                } 
            },
            colors: [bodyStyles.getPropertyValue('--color-primary-medium').trim()],
            plotOptions: { 
                bar: { 
                    horizontal: false, 
                    columnWidth: '65%', 
                    borderRadius: 5, 
                    dataLabels: {
                        position: 'top', 
                    },
                } 
            },
            dataLabels: { 
                enabled: true, 
                formatter: (val) => val + "%", 
                offsetY: -20, 
                style: { 
                    fontSize: '10px', 
                    fontWeight: 'bold',
                    colors: [bodyStyles.getPropertyValue('--color-text-primary').trim()]
                },
                background: { 
                    enabled: true,
                    foreColor: '#fff',
                    padding: 3,
                    borderRadius: 2,
                    borderWidth: 1,
                    borderColor: '#fff',
                    opacity: 0.0 
                },
                dropShadow: { 
                    enabled: true,
                    top: 1,
                    left: 1,
                    blur: 1,
                    color: '#FFF',
                    opacity: 0.6
                }
            },
            tooltip: { 
                y: { 
                    formatter: (val) => val.toFixed(1) + "%",
                    title: { formatter: (seriesName) => seriesName + ':' }
                }
            },
            grid: { 
                xaxis: { lines: { show: false } },
                yaxis: { lines: { show: false } },
            }
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

        const bodyStyles = getComputedStyle(document.body);
        const seriesData = data.map(item => ({ 
            x: new Date(item.date_str).getTime(), 
            y: item.daily_accuracy 
        }));

        const chartOptions = this._getChartDefaultOptions({
            chart: { 
                type: 'area', 
                height: 330, 
                zoom: { enabled: false },
                dropShadow: { enabled: true, top: 8, left: 0, blur: 6, color: bodyStyles.getPropertyValue('--color-secondary-green').trim(), opacity: 0.2 }
            },
            series: [{ name: 'Precisão Diária', data: seriesData }],
            xaxis: { 
                type: 'datetime', 
                labels: { 
                    datetimeUTC: false, 
                    format: 'dd MMM', 
                    style: { fontSize: '11px'} 
                },
                tooltip: { 
                    enabled: true,
                    formatter: function(val) {
                        return new Date(val).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
                    },
                    offsetY: 0,
                    style: {
                        fontSize: '11px',
                        fontFamily: bodyStyles.getPropertyValue('--font-family-sans').trim(),
                    },
                },
            },
            yaxis: { 
                min: 0, max: 100, tickAmount: 5, 
                labels: { 
                    formatter: (val) => val.toFixed(0) + "%", 
                    style: { fontSize: '11px'} 
                } 
            },
            colors: [bodyStyles.getPropertyValue('--color-secondary-green').trim()],
            fill: { 
                type: "gradient", 
                gradient: { 
                    shadeIntensity: 1, 
                    opacityFrom: 0.6, 
                    opacityTo: 0.05, 
                    stops: [0, 95, 100] 
                } 
            },
            stroke: { 
                width: 2.5,
                curve: 'smooth' 
            },
            markers: { 
                size: 4,
                colors: [bodyStyles.getPropertyValue('--color-white').trim()],
                strokeColors: bodyStyles.getPropertyValue('--color-secondary-green').trim(),
                strokeWidth: 2,
                hover: {
                    size: 6
                }
            },
            tooltip: { 
                x: { format: 'dd MMM yy' }, 
                y: { 
                    formatter: (val) => val !== undefined ? val.toFixed(1) + "%" : "N/A",
                    title: { formatter: (seriesName) => seriesName + ':' }
                } 
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
        const bodyStyles = getComputedStyle(document.body);
    
        const seriesData = data.map(item => ({ 
            x: new Date(item.date_str).getTime(), 
            y: item.questions_done 
        }));

        const chartOptions = this._getChartDefaultOptions({
            chart: { type: 'bar', height: 280, dropShadow: { enabled: true, top: 5, left: 0, blur: 3, opacity: 0.15 } },
            series: [{ name: 'Questões Respondidas', data: seriesData }],
            colors: [bodyStyles.getPropertyValue('--color-primary-medium').trim()],
            plotOptions: { 
                bar: { 
                    borderRadius: 4, 
                    columnWidth: '60%', 
                    colors: { 
                        ranges: [{
                            from: 0,
                            to: 5,
                            color: bodyStyles.getPropertyValue('--color-primary-light').trim() 
                        }, {
                            from: 6,
                            to: 15,
                            color: bodyStyles.getPropertyValue('--color-primary-medium').trim() 
                        }, {
                            from: 16,
                            to: 1000, 
                            color: bodyStyles.getPropertyValue('--color-primary-dark').trim() 
                        }]
                    },
                } 
            },
            dataLabels: { enabled: false }, 
            xaxis: {
                type: 'datetime',
                labels: { 
                    datetimeUTC: false, 
                    format: 'dd MMM', 
                    style: { fontSize: '10px' },
                    rotate: -45,
                    trim: true,
                    hideOverlappingLabels: true
                },
                title: { 
                    text: 'Data', 
                    style: { 
                        fontSize: '11px', 
                        fontWeight: 500,
                        fontFamily: bodyStyles.getPropertyValue('--font-family-sans').trim() 
                    } 
                }
            },
            yaxis: { 
                title: { 
                    text: 'Nº de Questões', 
                    style: { 
                        fontSize: '11px', 
                        fontWeight: 500,
                        fontFamily: bodyStyles.getPropertyValue('--font-family-sans').trim()
                    } 
                }, 
                labels: {style: {fontSize: '11px'}}
            },
            tooltip: { 
                x: { format: 'dd MMM yy' }, 
                y: { 
                    formatter: (val) => val.toLocaleString('pt-BR') + " questões",
                    title: { formatter: (seriesName) => seriesName + ':' }
                }
            },
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
        const bodyStyles = getComputedStyle(document.body);

        const chartOptions = this._getChartDefaultOptions({
            chart: { type: 'bar', height: 280, dropShadow: { enabled: true, top: 5, left: 0, blur: 3, opacity: 0.1 } },
            series: [{ name: 'Minutos de Estudo', data: data.data }],
            colors: [bodyStyles.getPropertyValue('--color-primary-dark').trim()], 
            plotOptions: { 
                bar: { 
                    borderRadius: 5, 
                    horizontal: false, 
                    columnWidth: '50%', 
                    distributed: false, 
                    dataLabels: {
                        position: 'top',
                    },
                } 
            },
            dataLabels: { 
                enabled: true, 
                formatter: (val) => val > 0 ? val + "m" : "", 
                offsetY: -18,
                style: { 
                    fontSize: '10px', 
                    fontWeight: 'bold',
                    colors: [bodyStyles.getPropertyValue('--color-text-primary').trim()]
                },
                dropShadow: { 
                    enabled: true, top: 1, left: 1, blur: 1, color: '#FFF', opacity: 0.65
                }
            },
            xaxis: { 
                categories: data.labels, 
                labels: { 
                    style: { 
                        fontSize: '11px', 
                        colors: bodyStyles.getPropertyValue('--color-text-secondary').trim()
                    } 
                },
                axisBorder: { show: false }, 
                axisTicks: { show: false } 
            },
            yaxis: { 
                title: { text: 'Minutos', style: { fontSize: '11px', fontWeight: 500, color: bodyStyles.getPropertyValue('--color-text-secondary').trim()} }, 
                labels: { style: { fontSize: '11px'} } 
            },
            tooltip: { 
                y: { 
                    formatter: (val) => val + " min",
                    title: { formatter: (seriesName) => seriesName + ':' }
                } 
            },
            grid: { 
                yaxis: { lines: { show: false } }
            }
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
        const bodyStyles = getComputedStyle(document.body);

        const difficulties = data.map(item => item.name);
        const accuracies = data.map(item => parseFloat(item.accuracy.toFixed(1)));
        
        const difficultyColors = [
            bodyStyles.getPropertyValue('--color-secondary-green').trim() || '#2a9d8f', 
            bodyStyles.getPropertyValue('--color-primary-medium').trim() || '#1a5f9e',   
            bodyStyles.getPropertyValue('--color-accent-red').trim() || '#e63946'        
        ];
        const seriesColors = difficulties.map(d => {
            if (d.toLowerCase().includes('fácil') || d.toLowerCase().includes('easy')) return difficultyColors[0];
            if (d.toLowerCase().includes('médio') || d.toLowerCase().includes('medium')) return difficultyColors[1];
            if (d.toLowerCase().includes('difícil') || d.toLowerCase().includes('hard')) return difficultyColors[2];
            return bodyStyles.getPropertyValue('--color-gray-500').trim(); 
        });

        const chartOptions = this._getChartDefaultOptions({
            chart: { type: 'bar', height: 280, dropShadow: { enabled: true, top: 5, left: 0, blur: 3, opacity: 0.1 } },
            series: [{ name: 'Precisão', data: accuracies }],
            colors: seriesColors, 
            plotOptions: { 
                bar: { 
                    horizontal: true, 
                    barHeight: '60%', 
                    borderRadius: 4,
                    distributed: true, 
                    dataLabels: {
                        position: 'top' 
                    }
                } 
            },
            dataLabels: { 
                enabled: true, 
                formatter: (val, opts) => {
                    const totalQuestions = data[opts.dataPointIndex]?.total || 0;
                    return val > 0 ? `${val.toFixed(0)}% (${totalQuestions})` : "";
                },
                style: { 
                    fontSize: '10px', 
                    fontWeight: 'bold',
                    colors: [bodyStyles.getPropertyValue('--color-text-primary').trim()]
                },
                offsetX: 22, 
                textAnchor: 'start', 
                dropShadow: { enabled: true, top: 1, left: 1, blur: 1, color: '#fff', opacity: 0.7 }
            },
            xaxis: { 
                categories: difficulties, 
                min: 0, max: 100, tickAmount: 5,
                labels: { 
                    formatter: (val) => val + "%", 
                    style: { fontSize: '11px', colors: bodyStyles.getPropertyValue('--color-text-secondary').trim()} 
                }
            },
            yaxis: { 
                 labels: { 
                    style: { fontSize: '11px', colors: bodyStyles.getPropertyValue('--color-text-secondary').trim()}
                }
            },
            tooltip: { 
                y: { 
                    formatter: (val, { seriesIndex, dataPointIndex, w }) => {
                         const totalQuestions = data[dataPointIndex]?.total || 0;
                         return `${val.toFixed(1)}% (de ${totalQuestions} questões)`;
                    },
                    title: { formatter: (seriesName) => seriesName + ':' }
                } 
            },
            legend: { show: false } 
        });
        this.charts.difficultyPerformance = new ApexCharts(this.elements.difficultyPerformanceChartEl, chartOptions);
        this.charts.difficultyPerformance.render();
    }
}