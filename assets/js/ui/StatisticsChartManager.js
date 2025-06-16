// assets/js/ui/StatisticsChartManager.js

/**
 * Realiza uma mesclagem profunda (deep merge) de dois objetos, preservando propriedades aninhadas.
 * @param {object} target - O objeto de destino.
 * @param {object} source - O objeto de origem, cujas propriedades irão sobrescrever as do destino.
 * @returns {object} Um novo objeto com as propriedades mescladas.
 */
function deepMerge(target, source) {
    const output = { ...target };
    if (isObject(target) && isObject(source)) {
        Object.keys(source).forEach(key => {
            if (isObject(source[key])) {
                if (!(key in target)) {
                    Object.assign(output, { [key]: source[key] });
                } else {
                    output[key] = deepMerge(target[key], source[key]);
                }
            } else {
                Object.assign(output, { [key]: source[key] });
            }
        });
    }
    return output;
}

/**
 * Verifica se um item é um objeto (e não um array ou null).
 * @param {*} item - O item a ser verificado.
 * @returns {boolean}
 */
function isObject(item) {
    return (item && typeof item === 'object' && !Array.isArray(item));
}


export default class StatisticsChartManager {
	constructor(quizUIInstance) {
		this.quizUI = quizUIInstance;

		this.store = null;
		this.actionOrchestrator = null;
		this.hasInitialized = false;

		this.elements = {
			overallAccuracyChartEl: document.getElementById(
				"chart-overall-accuracy"
			),
			categoryPerformanceChartEl: document.getElementById(
				"chart-category-performance"
			),
			learningProgressChartEl: document.getElementById(
				"chart-learning-progress"
			),
			studyHeatmapChartEl: document.getElementById("chart-study-heatmap"),
			studyTimeChartEl: document.getElementById("chart-study-time"),
			difficultyPerformanceChartEl: document.getElementById(
				"chart-difficulty-performance"
			),
			periodSelectEl: document.getElementById("stats-period-select"),
			totalQuestionsEl: document.getElementById("metric-total-questions"),
			maxStreakEl: document.getElementById("metric-max-streak"),
			totalScoreEl: document.getElementById("metric-total-score"),
			totalStudyTimeEl: document.getElementById(
				"metric-total-study-time"
			),
			noStatsDataMessageEl: document.getElementById(
				"no-stats-data-message"
			),
			statisticsDashboardContainer: document.querySelector(
				".statistics-dashboard"
			),
		};
		this.charts = {};
        this.heatmapTooltip = null; 
		this.currentPeriod = this.elements.periodSelectEl
			? this.elements.periodSelectEl.value
			: "30d";
		this.previousStatsState = {};
	}

	setStore(storeInstance) {
		this.store = storeInstance;
		if (this.store) {
			this.previousStatsState = this.store.getState().statistics;
			this.store.subscribe(this.handleStateUpdate.bind(this));
		}
	}

	setActionOrchestrator(orchestrator) {
		this.actionOrchestrator = orchestrator;
	}

	init() {
		if (this.hasInitialized) {
			return;
		}

		if (!this.elements.periodSelectEl) return;

		this.elements.periodSelectEl.addEventListener("change", (event) => {
			this.currentPeriod = event.target.value;
			this._triggerFetchStatistics();
		});

		const currentStats = this.store.getState().statistics;
		if (!currentStats.data && !currentStats.isLoading) {
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

		if (
			JSON.stringify(newStatsState) !==
			JSON.stringify(this.previousStatsState)
		) {
			this._render(newStatsState);
			this.previousStatsState = newStatsState;
		}
	}

	_render(statsState) {
		const { isLoading, data: statsData, error } = statsState;

		if (isLoading) {
			this._showLoadingPlaceholders();
			return;
		}

		this.elements.statisticsDashboardContainer?.classList.remove(
			"is-loading"
		);

		if (error) {
			this._showErrorState(error);
			return;
		}

		if (statsData && statsData.status === "success") {
			this._updateKeyMetrics(statsData.key_metrics);
			const hasAnyData =
				statsData.key_metrics?.total_questions_answered > 0;

			if (!hasAnyData) {
				if (this.elements.noStatsDataMessageEl)
					this.quizUI.showElement(this.elements.noStatsDataMessageEl);
				document
					.querySelectorAll(".chart-container .chart-placeholder")
					.forEach((p) => {
						this._showNoDataMessageForChart(
							p.parentElement,
							"Sem dados para o período."
						);
					});
			} else {
				if (this.elements.noStatsDataMessageEl)
					this.quizUI.hideElement(this.elements.noStatsDataMessageEl);
				this._renderOverallAccuracyChart(statsData.overall_accuracy);
				this._renderCategoryPerformanceChart(
					statsData.category_performance
				);
				this._renderLearningProgressChart(statsData.learning_progress);
				this._renderStudyHeatmapChart(statsData.study_heatmap);
				this._renderStudyTimeChart(statsData.study_time_detail);
				this._renderDifficultyPerformanceChart(
					statsData.difficulty_performance
				);
			}
		} else {
			this._showErrorState(
				statsData?.message || "Falha ao processar estatísticas."
			);
		}
	}
    
    _renderStudyHeatmapChart(data) {
        this._destroyChart('studyHeatmap');
        const container = this.elements.studyHeatmapChartEl;

        if (!container) return;
        container.innerHTML = '';

        if (!data || data.length === 0) {
            this._showNoDataMessageForChart(container, "Sem dados de frequência para exibir.");
            return;
        }

        this._createTooltip();
        const dataMap = new Map(data.map(d => [d.date_str, d.questions_done]));
        
        const today = new Date();
        const currentYear = today.getUTCFullYear();
        const startDate = new Date(Date.UTC(currentYear, 0, 1)); // Jan 1st
        const endDate = new Date(Date.UTC(currentYear, 11, 31)); // Dec 31st

        const heatmapContainer = document.createElement('div');
        heatmapContainer.className = 'heatmap-container';

        const grid = document.createElement('div');
        grid.className = 'heatmap-grid';
        
        const graphData = this._generateGraphElements(startDate, endDate, dataMap);

        grid.appendChild(graphData.daysOfWeek);
        grid.appendChild(graphData.months);
        grid.appendChild(graphData.graph);
        heatmapContainer.appendChild(grid);
        heatmapContainer.appendChild(this._createLegend());
        container.appendChild(heatmapContainer);
    }
    
    _generateGraphElements(startDate, endDate, dataMap) {
        const graph = document.createElement('div');
        graph.className = 'heatmap-graph';
        
        const monthsContainer = document.createElement('div');
        monthsContainer.className = 'heatmap-months';
        
        const daysContainer = document.createElement('div');
        daysContainer.className = 'heatmap-days-of-week';
        ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].forEach(day => {
            daysContainer.innerHTML += `<div>${day}</div>`;
        });

        let currentDate = new Date(startDate);
        const firstDayOfWeek = startDate.getUTCDay();

        for (let i = 0; i < firstDayOfWeek; i++) {
            const dayEl = document.createElement('div');
            dayEl.className = 'heatmap-day';
            dayEl.style.visibility = 'hidden';
            graph.appendChild(dayEl);
        }

        const monthLabels = [];
        const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
        let lastMonth = -1;
        let weekCount = 1;

        while (currentDate <= endDate) {
            const dateStr = currentDate.toISOString().split('T')[0];
            const count = dataMap.get(dateStr) || 0;
            const level = this._getContributionLevel(count);

            const dayEl = document.createElement('div');
            dayEl.className = 'heatmap-day';
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
                weekCount++;
            }
            
            currentDate.setUTCDate(currentDate.getUTCDate() + 1);
        }
        
        monthLabels.forEach(label => {
            const monthEl = document.createElement('div');
            monthEl.className = 'heatmap-month-label';
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
        this.heatmapTooltip = document.createElement('div');
        this.heatmapTooltip.className = 'heatmap-tooltip';
        document.body.appendChild(this.heatmapTooltip);
    }

    _addTooltipEvents(element) {
        element.addEventListener('mouseover', (e) => {
            const count = e.target.dataset.count;
            const dateStr = e.target.dataset.date;
            const date = new Date(`${dateStr}T00:00:00Z`);
            const formattedDate = date.toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
            
            const contributions = count === '1' ? '1 questão' : `${count} questões`;
            this.heatmapTooltip.innerHTML = `<strong>${contributions}</strong> em ${formattedDate}`;
            
            const rect = e.target.getBoundingClientRect();
            this.heatmapTooltip.style.left = `${rect.left + rect.width / 2}px`;
            this.heatmapTooltip.style.top = `${rect.top}px`;
            this.heatmapTooltip.classList.add('is-visible');
        });

        element.addEventListener('mouseleave', () => {
            this.heatmapTooltip.classList.remove('is-visible');
        });
    }

    _createLegend() {
        const legend = document.createElement('div');
        legend.className = 'heatmap-legend';
        legend.innerHTML = `
            <span>Menos</span>
            <ul>
                <li style="background-color: var(--heatmap-level-0);" data-level="0"></li>
                <li style="background-color: var(--heatmap-level-1);" data-level="1"></li>
                <li style="background-color: var(--heatmap-level-2);" data-level="2"></li>
                <li style="background-color: var(--heatmap-level-3);" data-level="3"></li>
                <li style="background-color: var(--heatmap-level-4);" data-level="4"></li>
            </ul>
            <span>Mais</span>
        `;
        this._addTooltipEventsToLegend(legend);
        return legend;
    }
    
    _addTooltipEventsToLegend(legendContainer){
         legendContainer.querySelectorAll('li').forEach(item => {
            item.addEventListener('mouseover', (e) => {
                const level = e.target.dataset.level;
                let text = "Sem atividades";
                if(level === "1") text = "1-4 questões";
                else if(level === "2") text = "5-9 questões";
                else if(level === "3") text = "10-19 questões";
                else if(level === "4") text = "20+ questões";

                this.heatmapTooltip.innerHTML = `<strong>${text}</strong>`;
                const rect = e.target.getBoundingClientRect();
                this.heatmapTooltip.style.left = `${rect.left + rect.width / 2}px`;
                this.heatmapTooltip.style.top = `${rect.top}px`;
                this.heatmapTooltip.classList.add('is-visible');
            });
            item.addEventListener('mouseleave', () => {
                 this.heatmapTooltip.classList.remove('is-visible');
            });
        });
    }

	_showLoadingPlaceholders() {
		this.elements.statisticsDashboardContainer?.classList.add("is-loading");
		document
			.querySelectorAll(".chart-container .chart-placeholder")
			.forEach((p) => {
				p.textContent = "Carregando gráfico...";
				p.style.color = "var(--color-text-muted)";
				this.quizUI.showElement(p);
			});
		Object.keys(this.charts).forEach((chartKey) =>
			this._destroyChart(chartKey)
		);
        if (this.elements.studyHeatmapChartEl) this.elements.studyHeatmapChartEl.innerHTML = '<p class="chart-placeholder" style="display:block; text-align:center;">Carregando gráfico...</p>';

		if (this.elements.noStatsDataMessageEl) {
			this.quizUI.hideElement(this.elements.noStatsDataMessageEl);
		}
	}

	_showErrorState(errorMessage) {
		this._updateKeyMetrics(null);
		document.querySelectorAll(".chart-container").forEach((container) => {
			const placeholder = container.querySelector(".chart-placeholder");
			if (placeholder) {
				placeholder.textContent = errorMessage;
				placeholder.style.color = "var(--color-accent-red)";
				this.quizUI.showElement(placeholder);
			}
		});
		if (this.elements.noStatsDataMessageEl) {
			this.elements.noStatsDataMessageEl.textContent = errorMessage;
			this.elements.noStatsDataMessageEl.style.color =
				"var(--color-accent-red)";
			this.quizUI.showElement(this.elements.noStatsDataMessageEl);
		}
	}

	_hideLoadingPlaceholder(chartEl) {
		const placeholder = chartEl?.querySelector(".chart-placeholder");
		if (placeholder) this.quizUI.hideElement(placeholder);
	}

	_showNoDataMessageForChart(
		chartEl,
		message = "Sem dados para este gráfico."
	) {
        if(!chartEl) return;
		chartEl.innerHTML = '';
        const placeholder = document.createElement('p');
        placeholder.className = 'chart-placeholder';
        placeholder.style.textAlign = 'center';
		placeholder.textContent = message;
		placeholder.style.color = "var(--color-text-muted)";
        chartEl.appendChild(placeholder);
		this.quizUI.showElement(placeholder);
	}

	_updateKeyMetrics(keyMetrics) {
		const metrics = keyMetrics || {
			total_questions_answered: 0,
			max_streak: 0,
			total_score_all_time: 0,
			total_study_time_seconds: 0,
		};
		if (this.elements.totalQuestionsEl)
			this.elements.totalQuestionsEl.textContent =
				metrics.total_questions_answered.toLocaleString("pt-BR");
		if (this.elements.maxStreakEl)
			this.elements.maxStreakEl.textContent =
				metrics.max_streak.toLocaleString("pt-BR");
		if (this.elements.totalScoreEl)
			this.elements.totalScoreEl.textContent =
				metrics.total_score_all_time.toLocaleString("pt-BR");
		if (this.elements.totalStudyTimeEl) {
			const totalSeconds = metrics.total_study_time_seconds || 0;
			const minutes = Math.floor(totalSeconds / 60);
			const hours = Math.floor(minutes / 60);
			const remainingMinutes = minutes % 60;
			this.elements.totalStudyTimeEl.textContent =
				hours > 0 ? `${hours}h ${remainingMinutes}m` : `${minutes}m`;
		}
	}

	_destroyChart(chartKey) {
		if (
			this.charts[chartKey] &&
			typeof this.charts[chartKey].destroy === "function"
		) {
			try {
				this.charts[chartKey].destroy();
			} catch (e) {}
		}
		this.charts[chartKey] = null;
	}

	// --- INÍCIO DA MODIFICAÇÃO ---
	_getChartDefaultOptions(extraOptions = {}) {
		const bodyStyles = getComputedStyle(document.body);
		const fontFamily =
			bodyStyles.getPropertyValue("--font-family-sans").trim() ||
			"Roboto, sans-serif";
			
		const defaultOptions = {
			chart: {
				fontFamily: fontFamily,
				foreColor: bodyStyles.getPropertyValue("--color-text-secondary").trim(),
				toolbar: {
					show: true,
					tools: {
						download: true,
						selection: false,
						zoom: false,
						zoomin: false,
						zoomout: false,
						pan: false,
						reset: true,
					},
				},
				animations: {
					enabled: true,
					easing: "easeinout",
					speed: 600,
				},
			},
			grid: {
				borderColor: bodyStyles.getPropertyValue("--color-gray-200").trim(),
				strokeDashArray: 4,
			},
			stroke: { width: 2.5, curve: "smooth" },
			markers: { size: 0, hover: { size: 5, sizeOffset: 2 } },
			tooltip: {
				theme: "light",
				style: { fontSize: "12px", fontFamily: fontFamily },
				x: { format: "dd MMM yy" },
			},
			legend: {
				fontFamily: fontFamily,
				fontWeight: 500,
				fontSize: "12px",
			},
			noData: {
				text: "Sem dados para exibir.",
				style: {
					color: bodyStyles.getPropertyValue("--color-text-secondary").trim(),
					fontSize: "14px",
					fontFamily: fontFamily,
				},
			},
			colors: [
				bodyStyles.getPropertyValue("--color-primary-medium").trim(),
				bodyStyles.getPropertyValue("--color-secondary-green").trim(),
				bodyStyles.getPropertyValue("--color-accent-red").trim(),
				bodyStyles.getPropertyValue("--color-accent-yellow").trim(),
			],
		};

		// Retorna as opções padrão mescladas com as opções extras de forma profunda
		return deepMerge(defaultOptions, extraOptions);
	}

	_renderOverallAccuracyChart(data) {
		this._destroyChart("overallAccuracy");
		if (
			!this.elements.overallAccuracyChartEl ||
			!data ||
			(data.correct === 0 && data.incorrect === 0)
		) {
			this._showNoDataMessageForChart(
				this.elements.overallAccuracyChartEl,
				"Sem dados de precisão."
			);
			return;
		}
		this._hideLoadingPlaceholder(this.elements.overallAccuracyChartEl);
		const chartOptions = this._getChartDefaultOptions({
			chart: { type: "donut", height: 280 },
			series: [data.correct, data.incorrect],
			labels: ["Acertos", "Erros"],
			plotOptions: {
				pie: {
					donut: {
						size: "70%",
						labels: {
							show: true,
							name: { show: true },
							value: {
								show: true,
								formatter: (val, { seriesIndex, w }) => {
									const total = w.globals.seriesTotals.reduce((a, b) => a + b, 0);
									return total > 0 ? ((w.globals.series[seriesIndex] / total) * 100).toFixed(0) + "%" : "0%";
								},
							},
							total: {
								show: true,
								showAlways: true,
								label: "Total",
								formatter: (w) => w.globals.seriesTotals.reduce((a, b) => a + b, 0).toLocaleString("pt-BR"),
							},
						},
					},
				},
			},
			legend: { position: "bottom" },
			dataLabels: { enabled: false },
			tooltip: {
				y: {
					formatter: (val) => val.toLocaleString("pt-BR") + " questões",
				},
			},
			responsive: [{
                breakpoint: 768,
                options: {
                    chart: { height: 240 },
                    legend: { position: 'bottom' }
                }
            }]
		});
		this.charts.overallAccuracy = new ApexCharts(
			this.elements.overallAccuracyChartEl,
			chartOptions
		);
		this.charts.overallAccuracy.render();
	}

	_renderCategoryPerformanceChart(data) {
		this._destroyChart("categoryPerformance");
		if (!this.elements.categoryPerformanceChartEl || !data || data.length === 0) {
			this._showNoDataMessageForChart(this.elements.categoryPerformanceChartEl, "Sem dados de categoria.");
			return;
		}
		this._hideLoadingPlaceholder(this.elements.categoryPerformanceChartEl);
		const topData = data.slice(0, 7);
		const categories = topData.map((item) => item.name.length > 18 ? item.name.substring(0, 16) + "..." : item.name);
		const accuracies = topData.map((item) => parseFloat(item.accuracy.toFixed(1)));
		const chartOptions = this._getChartDefaultOptions({
			chart: { type: "bar", height: 330 },
			series: [{ name: "Precisão", data: accuracies }],
			xaxis: {
				categories: categories,
				labels: { rotate: -35, trim: true, maxHeight: 70 },
			},
			yaxis: {
				min: 0,
				max: 100,
				labels: { formatter: (val) => val.toFixed(0) + "%" },
			},
			plotOptions: {
				bar: {
                    borderRadius: 5,
					dataLabels: { position: "top" },
				},
			},
			dataLabels: {
				enabled: true,
				formatter: (val) => val + "%",
				offsetY: -20,
				style: {
					fontSize: "10px",
					fontWeight: "bold",
					colors: [ getComputedStyle(document.body).getPropertyValue("--color-text-primary").trim() ],
				},
			},
			tooltip: {
				y: { formatter: (val) => val.toFixed(1) + "%" },
			},
			responsive: [{
                breakpoint: 768,
                options: {
                    chart: { height: 300 },
                    xaxis: { labels: { rotate: -45, style: { fontSize: '10px' } } },
					dataLabels: { style: { fontSize: '9px' } }
                }
            }]
		});
		this.charts.categoryPerformance = new ApexCharts(
			this.elements.categoryPerformanceChartEl,
			chartOptions
		);
		this.charts.categoryPerformance.render();
	}

	_renderLearningProgressChart(data) {
		this._destroyChart("learningProgress");
		if (!this.elements.learningProgressChartEl || !data || data.length < 2) {
			this._showNoDataMessageForChart(this.elements.learningProgressChartEl, "Dados insuficientes para progresso.");
			return;
		}
		this._hideLoadingPlaceholder(this.elements.learningProgressChartEl);
		const seriesData = data.map((item) => ({
			x: new Date(item.date_str).getTime(),
			y: item.daily_accuracy,
		}));
		const chartOptions = this._getChartDefaultOptions({
			chart: {
				type: "area",
				height: 330,
				zoom: { enabled: false },
			},
			series: [{ name: "Precisão Diária", data: seriesData }],
			xaxis: {
				type: "datetime",
				labels: { datetimeUTC: false, format: "dd MMM" },
			},
			yaxis: {
				min: 0,
				max: 100,
				labels: { formatter: (val) => val.toFixed(0) + "%" },
			},
			fill: {
				type: "gradient",
				gradient: {
					shadeIntensity: 1,
					opacityFrom: 0.6,
					opacityTo: 0.05,
					stops: [0, 95, 100],
				},
			},
			markers: {
				size: 4,
                colors: [ getComputedStyle(document.body).getPropertyValue("--color-white").trim() ],
				strokeColors: getComputedStyle(document.body).getPropertyValue("--color-secondary-green").trim(),
				strokeWidth: 2,
				hover: { size: 6 },
			},
			tooltip: {
				y: { formatter: (val) => val !== undefined ? val.toFixed(1) + "%" : "N/A" },
			},
			dataLabels: { enabled: false },
			responsive: [{
                breakpoint: 768,
                options: {
                    chart: { height: 260 },
                    markers: { size: 3 }
                }
            }]
		});
		this.charts.learningProgress = new ApexCharts(
			this.elements.learningProgressChartEl,
			chartOptions
		);
		this.charts.learningProgress.render();
	}

	_renderStudyTimeChart(data) {
		this._destroyChart("studyTime");
		if (!this.elements.studyTimeChartEl || !data || data.data.every((d) => d === 0)) {
			this._showNoDataMessageForChart(this.elements.studyTimeChartEl, "Sem dados de tempo de estudo.");
			return;
		}
		this._hideLoadingPlaceholder(this.elements.studyTimeChartEl);
		const chartOptions = this._getChartDefaultOptions({
			chart: { type: "bar", height: 280 },
			series: [{ name: "Minutos de Estudo", data: data.data }],
			plotOptions: {
				bar: {
					borderRadius: 5,
					dataLabels: { position: "top" },
				},
			},
			dataLabels: {
				enabled: true,
				formatter: (val) => (val > 0 ? val + "m" : ""),
				offsetY: -18,
				style: {
					fontSize: "10px",
					fontWeight: "bold",
					colors: [ getComputedStyle(document.body).getPropertyValue("--color-text-primary").trim() ],
				},
			},
			xaxis: { categories: data.labels },
			yaxis: { title: { text: "Minutos" } },
			tooltip: {
				y: { formatter: (val) => val + " min" },
			},
			responsive: [{
                breakpoint: 768,
                options: {
                    chart: { height: 260 },
                    dataLabels: { enabled: false },
                }
            }]
		});
		this.charts.studyTime = new ApexCharts(
			this.elements.studyTimeChartEl,
			chartOptions
		);
		this.charts.studyTime.render();
	}

	_renderDifficultyPerformanceChart(data) {
		this._destroyChart("difficultyPerformance");
		if (!this.elements.difficultyPerformanceChartEl || !data || data.length === 0 || data.every((d) => d.total === 0)) {
			this._showNoDataMessageForChart(this.elements.difficultyPerformanceChartEl, "Sem dados de dificuldade.");
			return;
		}
		this._hideLoadingPlaceholder(this.elements.difficultyPerformanceChartEl);
		const bodyStyles = getComputedStyle(document.body);
		const difficulties = data.map((item) => item.name);
		const accuracies = data.map((item) => parseFloat(item.accuracy.toFixed(1)));
		const difficultyColors = [
			bodyStyles.getPropertyValue("--color-secondary-green").trim(),
			bodyStyles.getPropertyValue("--color-primary-medium").trim(),
			bodyStyles.getPropertyValue("--color-accent-red").trim(),
		];
		const seriesColors = difficulties.map((d) => {
			if (d.toLowerCase().includes("fácil")) return difficultyColors[0];
			if (d.toLowerCase().includes("médio")) return difficultyColors[1];
			if (d.toLowerCase().includes("difícil")) return difficultyColors[2];
			return bodyStyles.getPropertyValue("--color-gray-500").trim();
		});
		const chartOptions = this._getChartDefaultOptions({
			chart: { type: "bar", height: 280 },
			series: [{ name: "Precisão", data: accuracies }],
			colors: seriesColors,
			plotOptions: {
				bar: {
					horizontal: true,
					barHeight: "60%",
					borderRadius: 4,
					distributed: true,
					dataLabels: { position: "top" },
				},
			},
			dataLabels: {
				enabled: true,
				formatter: (val, opts) => {
					const totalQuestions = data[opts.dataPointIndex]?.total || 0;
					return val > 0 ? `${val.toFixed(0)}% (${totalQuestions})` : "";
				},
				offsetX: 22,
				textAnchor: "start",
			},
			xaxis: {
				categories: difficulties,
				min: 0,
				max: 100,
				labels: { formatter: (val) => val + "%" },
			},
			tooltip: {
				y: {
					formatter: (val, { dataPointIndex }) => {
						const totalQuestions = data[dataPointIndex]?.total || 0;
						return `${val.toFixed(1)}% (de ${totalQuestions} questões)`;
					},
				},
			},
			legend: { show: false },
			responsive: [{
                breakpoint: 768,
                options: {
                    chart: { height: 240 },
					dataLabels: {
						style: { fontSize: '10px' },
						offsetX: 15
					}
                }
            }]
		});
		this.charts.difficultyPerformance = new ApexCharts(
			this.elements.difficultyPerformanceChartEl,
			chartOptions
		);
		this.charts.difficultyPerformance.render();
	}
}