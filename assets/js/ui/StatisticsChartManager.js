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
                        categoryPerformanceChartEl: document.getElementById(
                                "chart-category-performance"
                        ),
                        learningProgressChartEl: document.getElementById(
                                "chart-learning-progress"
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
                        accuracyRingEl: document.querySelector(
                                "[data-role="accuracy-ring"]"
                        ),
                        accuracyValueEl: document.querySelector(
                                "[data-role="accuracy-value"]"
                        ),
                        accuracyCorrectEl: document.querySelector(
                                "[data-role="accuracy-correct"]"
                        ),
                        accuracyIncorrectEl: document.querySelector(
                                "[data-role="accuracy-incorrect"]"
                        ),
                        bestCategoryNameEl: document.querySelector(
                                "[data-role="best-category-name"]"
                        ),
                        bestCategoryDetailEl: document.querySelector(
                                "[data-role="best-category-detail"]"
                        ),
                        focusCategoryNameEl: document.querySelector(
                                "[data-role="focus-category-name"]"
                        ),
                        focusCategoryDetailEl: document.querySelector(
                                "[data-role="focus-category-detail"]"
                        ),
                        difficultyHighlightEl: document.querySelector(
                                "[data-role="difficulty-highlight"]"
                        ),
                        difficultyDetailEl: document.querySelector(
                                "[data-role="difficulty-detail"]"
                        ),
                        studyHighlightEl: document.querySelector(
                                "[data-role="study-highlight"]"
                        ),
                        studyDetailEl: document.querySelector(
                                "[data-role="study-detail"]"
                        ),
                };
                this.charts = {};

                const initialPeriodValue = this.elements.periodSelectEl
                        ? this.elements.periodSelectEl.value
                        : null;
                this.currentPeriod = this._normalizePeriodValue(initialPeriodValue);

                if (
                        this.elements.periodSelectEl &&
                        this.elements.periodSelectEl.value !== this.currentPeriod
                ) {
                        const matchingOption = this.elements.periodSelectEl.querySelector(
                                `option[value="${this.currentPeriod}"]`
                        );
                        if (matchingOption) {
                                this.elements.periodSelectEl.value = this.currentPeriod;
                        }
                }

                this.previousStatsState = {};
        }

        _normalizePeriodValue(rawValue) {
                const DEFAULT_PERIOD = "30d";

                if (rawValue === undefined || rawValue === null) {
                        return DEFAULT_PERIOD;
                }

                const normalizedValue = String(rawValue).trim().toLowerCase();

                if (normalizedValue === "all") {
                        return "all";
                }

                const match = normalizedValue.match(/^(\d+)(d)?$/);
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
                        const selectEl = event.target;
                        const normalizedPeriod = this._normalizePeriodValue(
                                selectEl.value
                        );

                        if (selectEl.value !== normalizedPeriod) {
                                const matchingOption = selectEl.querySelector(
                                        `option[value="${normalizedPeriod}"]`
                                );
                                if (matchingOption) {
                                        selectEl.value = normalizedPeriod;
                                }
                        }

                        this.currentPeriod = normalizedPeriod;
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
                        this._updateAccuracyInsight(statsData.overall_accuracy);
                        this._updateCategoryInsights(statsData.category_performance);
                        this._updateDifficultyInsight(statsData.difficulty_performance);
                        this._updateStudyInsights(
                                statsData.study_time_detail,
                                statsData.learning_progress
                        );

                        const hasAnyData =
                                statsData.key_metrics?.total_questions_answered > 0;

                        if (!hasAnyData) {
                                if (this.elements.noStatsDataMessageEl)
                                        this.quizUI.showElement(
                                                this.elements.noStatsDataMessageEl
                                        );
                                document
                                        .querySelectorAll(
                                                ".chart-container .chart-placeholder"
                                        )
                                        .forEach((p) => {
                                                this._showNoDataMessageForChart(
                                                        p.parentElement,
                                                        "Sem dados para o período."
                                                );
                                        });
                        } else {
                                if (this.elements.noStatsDataMessageEl)
                                        this.quizUI.hideElement(
                                                this.elements.noStatsDataMessageEl
                                        );
                                this._renderCategoryPerformanceChart(
                                        statsData.category_performance
                                );
                                this._renderLearningProgressChart(
                                        statsData.learning_progress
                                );
                        }
                } else {
                        this._showErrorState(
                                statsData?.message || "Falha ao processar estatísticas."
                        );
                }
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

	_setText(target, value) {
		if (target) {
			target.textContent = value;
		}
	}

	_updateAccuracyInsight(accuracyData) {
		const correct = accuracyData?.correct ?? 0;
		const incorrect = accuracyData?.incorrect ?? 0;
		const total = correct + incorrect;
		const accuracy =
			total > 0 ? Math.round((correct / total) * 100) : null;

		if (this.elements.accuracyRingEl) {
			const progress =
				accuracy !== null ? Math.max(0, Math.min(accuracy, 100)) : 0;
			this.elements.accuracyRingEl.style.setProperty(
				"--progress",
				progress
			);
		}

		this._setText(
			this.elements.accuracyValueEl,
			accuracy !== null ? `${accuracy}%` : "--%"
		);
		this._setText(
			this.elements.accuracyCorrectEl,
			total > 0 ? correct.toLocaleString("pt-BR") : "--"
		);
		this._setText(
			this.elements.accuracyIncorrectEl,
			total > 0 ? incorrect.toLocaleString("pt-BR") : "--"
		);
	}

	_updateCategoryInsights(categoryData) {
		const categories = Array.isArray(categoryData)
			? categoryData.filter(
				(item) =>
					typeof item?.accuracy === "number" && item.total > 0
			  )
			: [];

		if (!categories.length) {
			this._setText(this.elements.bestCategoryNameEl, "--");
			this._setText(
				this.elements.bestCategoryDetailEl,
				"Complete mais quizzes para identificar seu melhor desempenho."
			);
			this._setText(this.elements.focusCategoryNameEl, "--");
			this._setText(
				this.elements.focusCategoryDetailEl,
				"Responder novas sessões ajudará a mapear suas oportunidades."
			);
			return;
		}

		const best = categories[0];
		const worst = categories[categories.length - 1];

		const bestAccuracy = Math.round(best.accuracy);
		this._setText(this.elements.bestCategoryNameEl, best.name);
		this._setText(
			this.elements.bestCategoryDetailEl,
			`${bestAccuracy}% de acerto em ${best.total.toLocaleString("pt-BR")} questão${
				best.total === 1 ? "" : "s"
			}.`
		);

		this._setText(this.elements.focusCategoryNameEl, worst.name);

		const worstAccuracy = Math.round(worst.accuracy);
		let focusMessage;

		if (categories.length === 1) {
			focusMessage =
				"Explore novas categorias para ampliar sua variedade de estudos.";
		} else if (worstAccuracy >= 75) {
			focusMessage = `Você mantém ${worstAccuracy}% de acerto — continue reforçando para não perder o ritmo.`;
		} else {
			focusMessage = `Revise os conteúdos para elevar os ${worstAccuracy}% de acerto.`;
		}

		this._setText(this.elements.focusCategoryDetailEl, focusMessage);
	}

	_updateDifficultyInsight(difficultyData) {
		const difficulties = Array.isArray(difficultyData)
			? difficultyData.filter((item) => item.total > 0)
			: [];

		if (!difficulties.length) {
			this._setText(this.elements.difficultyHighlightEl, "--");
			this._setText(
				this.elements.difficultyDetailEl,
				"Ainda precisamos de mais dados para entender seu ritmo."
			);
			return;
		}

		difficulties.sort((a, b) => b.accuracy - a.accuracy);
		const top = difficulties[0];
		const bottom = difficulties[difficulties.length - 1];

		const topAccuracy = Math.round(top.accuracy);
		this._setText(this.elements.difficultyHighlightEl, top.name);
		let detail = `Você acerta ${topAccuracy}% das questões nesse nível.`;

		if (difficulties.length > 1 && bottom !== top) {
			const bottomAccuracy = Math.round(bottom.accuracy);
			detail += ` Atenção extra para ${bottom.name}: ${bottomAccuracy}% de acerto.`;
		}

		this._setText(this.elements.difficultyDetailEl, detail);
	}

	_updateStudyInsights(studyTimeData, learningProgressData) {
		const labels = Array.isArray(studyTimeData?.labels)
			? studyTimeData.labels
			: [];
		const minutesData = Array.isArray(studyTimeData?.data)
			? studyTimeData.data
			: [];

		const totals = minutesData.map((value) => Number(value) || 0);
		const totalMinutes = totals.reduce((sum, value) => sum + value, 0);
		let highlightLabel = null;
		let highlightMinutes = 0;

		totals.forEach((value, index) => {
			if (value > highlightMinutes) {
				highlightMinutes = value;
				highlightLabel = labels[index] ?? null;
			}
		});

		if (!totalMinutes || !highlightLabel) {
			this._setText(this.elements.studyHighlightEl, "--");
			this._setText(
				this.elements.studyDetailEl,
				"Complete quizzes em dias diferentes para revelar padrões."
			);
			return;
		}

		this._setText(this.elements.studyHighlightEl, highlightLabel);
		const totalFormatted = this._formatMinutes(totalMinutes);
		const peakFormatted = this._formatMinutes(highlightMinutes);

		let detail = `Maior dedicação em ${highlightLabel}: ${peakFormatted}. Total na semana: ${totalFormatted}.`;

		const accuracies = Array.isArray(learningProgressData)
			? learningProgressData
				.map((item) => Number(item?.daily_accuracy))
				.filter((value) => !Number.isNaN(value))
			: [];

		if (accuracies.length >= 2) {
			const first = accuracies[0];
			const last = accuracies[accuracies.length - 1];
			const diff = Math.round(last - first);

			if (diff > 1) {
				detail += ` Precisão subiu ${diff} pts no período.`;
			} else if (diff < -1) {
				detail += ` Precisão caiu ${Math.abs(diff)} pts — revise os conteúdos-chave.`;
			} else {
				detail += " Precisão estável no período.";
			}
		} else {
			detail += " Continue respondendo para acompanhar a evolução.";
		}

		this._setText(this.elements.studyDetailEl, detail);
	}

	_formatMinutes(totalMinutes) {
		const minutesInt = Math.max(0, Math.round(totalMinutes));
		const hours = Math.floor(minutesInt / 60);
		const minutes = minutesInt % 60;

		if (hours === 0) {
			return `${minutes} min`;
		}

		return minutes === 0 ? `${hours} h` : `${hours} h ${minutes} min`;
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

		return deepMerge(defaultOptions, extraOptions);
	}


    // --- INÍCIO DA ESTRATÉGIA DISRUPTIVA: Reconstrução com HTML/CSS ---
	_renderCategoryPerformanceChart(data) {
		this._destroyChart("categoryPerformance"); 
        const container = this.elements.categoryPerformanceChartEl;
		if (!container) return;

		if (!data || data.length === 0) {
			this._showNoDataMessageForChart(container, "Sem dados de categoria.");
			return;
		}

		this._hideLoadingPlaceholder(container);
		container.innerHTML = ''; // Limpa o contêiner de qualquer conteúdo anterior

		const topData = data.slice(0, 10);

		const list = document.createElement('ul');
		list.className = 'category-performance-list';

		topData.forEach(item => {
			const accuracy = parseFloat(item.accuracy.toFixed(1));

			const listItem = document.createElement('li');
			listItem.className = 'category-performance-item';

			const label = document.createElement('span');
			label.className = 'category-performance-item__label';
			label.textContent = item.name;
			label.title = item.name; // Adiciona um tooltip nativo com o nome completo

			const value = document.createElement('span');
			value.className = 'category-performance-item__value';
			value.textContent = `${accuracy.toFixed(0)}%`;

			const barContainer = document.createElement('div');
			barContainer.className = 'category-performance-item__bar-container';

			const bar = document.createElement('div');
			bar.className = 'category-performance-item__bar';

			// Adiciona a barra ao contêiner antes de animar para garantir que a transição CSS funcione
			barContainer.appendChild(bar);

            listItem.appendChild(label);
            listItem.appendChild(value);
            listItem.appendChild(barContainer);

			list.appendChild(listItem);
            
            // Usa um pequeno timeout para permitir que o elemento entre no DOM antes de animar a largura
            setTimeout(() => {
                bar.style.width = `${accuracy}%`;
            }, 50);
		});

		container.appendChild(list);
	}
    // --- FIM DA ESTRATÉGIA DISRUPTIVA ---
    
    _calculateMovingAverage(data, windowSize) {
        if (!data || data.length < windowSize) return [];
        
        const smoothedData = [];
        for (let i = 0; i <= data.length - windowSize; i++) {
            const windowSlice = data.slice(i, i + windowSize);
            const sum = windowSlice.reduce((acc, point) => acc + point.y, 0);
            const average = sum / windowSize;
            
            const pointInTime = windowSlice[windowSize - 1].x;
            smoothedData.push({ x: pointInTime, y: parseFloat(average.toFixed(1)) });
        }
        return smoothedData;
    }

	_renderLearningProgressChart(data) {
		this._destroyChart("learningProgress");
		if (!this.elements.learningProgressChartEl || !data || data.length < 2) {
			this._showNoDataMessageForChart(this.elements.learningProgressChartEl, "Dados insuficientes para progresso.");
			return;
		}
		this._hideLoadingPlaceholder(this.elements.learningProgressChartEl);

		const dailyData = data.map((item) => ({
			x: new Date(item.date_str).getTime(),
			y: item.daily_accuracy,
		}));

        const movingAverageData = this._calculateMovingAverage(dailyData, 7);
        const bodyStyles = getComputedStyle(document.body);

		const chartOptions = this._getChartDefaultOptions({
			chart: {
				type: "line",
				height: 330,
                zoom: {
                    enabled: false
                },
			},
			series: [
                {
                    name: "Precisão Diária",
                    type: 'bar',
                    data: dailyData
                },
                {
                    name: 'Média Móvel (7 dias)',
                    type: 'line',
                    data: movingAverageData
                }
            ],
            colors: [
                bodyStyles.getPropertyValue("--color-primary-light").trim(),
                bodyStyles.getPropertyValue("--color-secondary-green").trim(),
            ],
			stroke: {
				width: [0, 3], 
				curve: 'smooth'
			},
            plotOptions: {
                bar: {
                    columnWidth: '60%'
                }
            },
            fill: {
                opacity: [0.8, 1],
            },
			xaxis: {
				type: "datetime",
				labels: { datetimeUTC: false, format: "dd MMM" },
			},
			yaxis: {
				min: 0,
				max: 100,
				title: { text: "Precisão" },
				labels: { formatter: (val) => val.toFixed(0) + "%" },
			},
			tooltip: {
                shared: true,
                intersect: false,
				y: { formatter: (val) => val !== undefined ? val.toFixed(1) + "%" : "N/A" },
			},
			dataLabels: { enabled: false },
            legend: {
                position: 'top',
                horizontalAlign: 'left'
            }
		});
		this.charts.learningProgress = new ApexCharts(
			this.elements.learningProgressChartEl,
			chartOptions
		);
		this.charts.learningProgress.render();
	}
}
