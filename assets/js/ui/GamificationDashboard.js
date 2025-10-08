// assets/js/ui/GamificationDashboard.js

export default class GamificationDashboard {
    constructor() {
        this.store = null;
        this.actionOrchestrator = null;
        this.unsubscribe = null;

        this.snapshot = null;
        this.lastStoreSnapshot = null;

        this.currentFilter = 'all';
        this.searchQuery = '';

        this.challengeTimers = [];
        this.challengeIntervalId = null;

        this.hasInitialized = false;

        this.containers = {
            dashboard: document.querySelector('[data-gamification-dashboard]'),
            missions: document.querySelector('[data-gamification-missions]'),
        };

        this.elements = {
            overview: null,
            recordsList: null,
            recordsUpdatedAt: null,
            achievementGrid: null,
            upcomingList: null,
            filterGroup: null,
            searchInput: null,
            activityFeed: null,
            activeChallengesList: null,
            completedChallengesList: null,
            rewardsAvailableList: null,
            rewardsUpcomingList: null,
            rewardsClaimedList: null,
            rewardsFeedback: null,
        };
    }

    setStore(storeInstance) {
        if (this.unsubscribe) {
            this.unsubscribe();
            this.unsubscribe = null;
        }
        this.store = storeInstance;
        if (this.store && typeof this.store.subscribe === 'function') {
            this.unsubscribe = this.store.subscribe(() => this._handleStoreUpdate());
        }
    }

    setActionOrchestrator(orchestrator) {
        this.actionOrchestrator = orchestrator;
    }

    init() {
        if (this.hasInitialized) {
            return;
        }

        if (!this.containers.dashboard && !this.containers.missions) {
            return;
        }

        this._cacheElements();
        this._loadInitialSnapshot();
        this._attachEventListeners();
        this._renderFromSnapshot();

        this.hasInitialized = true;
    }

    _cacheElements() {
        if (this.containers.dashboard) {
            this.elements.overview = this.containers.dashboard.querySelector('[data-gamification-overview]');
            this.elements.recordsList = document.getElementById('gamification-records-list');
            this.elements.recordsUpdatedAt = document.getElementById('gamification-records-updated');
            this.elements.achievementGrid = document.getElementById('gamification-achievement-grid');
            this.elements.upcomingList = document.getElementById('upcoming-achievements-list');
            this.elements.filterGroup = document.getElementById('achievements-filter-group');
            this.elements.searchInput = document.getElementById('achievements-search');
            this.elements.activityFeed = document.getElementById('gamification-activity-feed');
        }

        if (this.containers.missions) {
            this.elements.activeChallengesList = document.getElementById('active-challenges-list');
            this.elements.completedChallengesList = document.getElementById('completed-challenges-list');
            this.elements.rewardsAvailableList = document.getElementById('rewards-available-list');
            this.elements.rewardsUpcomingList = document.getElementById('rewards-upcoming-list');
            this.elements.rewardsClaimedList = document.getElementById('rewards-claimed-list');
            this.elements.rewardsFeedback = document.getElementById('rewards-feedback');
        }
    }

    _loadInitialSnapshot() {
        const script = document.getElementById('gamification-dashboard-data');
        if (script) {
            try {
                this.snapshot = JSON.parse(script.textContent);
                this.lastStoreSnapshot = this.snapshot;
                return;
            } catch (error) {
                console.error('GamificationDashboard: não foi possível interpretar o snapshot inicial.', error);
            }
        }

        if (!this.snapshot && this.store) {
            const state = this.store.getState();
            if (state?.user?.gamification) {
                this.snapshot = state.user.gamification;
                this.lastStoreSnapshot = this.snapshot;
            }
        }
    }

    _attachEventListeners() {
        if (this.elements.filterGroup) {
            this.elements.filterGroup.addEventListener('click', (event) => {
                const button = event.target.closest('[data-achievements-filter]');
                if (!button) {
                    return;
                }
                event.preventDefault();
                const { achievementsFilter } = button.dataset;
                if (!achievementsFilter || this.currentFilter === achievementsFilter) {
                    return;
                }
                this.currentFilter = achievementsFilter;
                this._updateFilterButtons(button);
                this._renderAchievements();
            });
        }

        if (this.elements.searchInput) {
            this.elements.searchInput.addEventListener('input', (event) => {
                this.searchQuery = (event.target.value || '').trim();
                this._renderAchievements();
            });
        }

        if (this.containers.missions) {
            this.containers.missions.addEventListener('click', async (event) => {
                const button = event.target.closest('[data-claim-reward]');
                if (!button) {
                    return;
                }

                const rewardCard = button.closest('[data-level-id][data-reward-id]');
                if (!rewardCard) {
                    return;
                }

                const levelId = Number.parseInt(rewardCard.dataset.levelId, 10);
                const rewardId = rewardCard.dataset.rewardId;

                if (!Number.isInteger(levelId) || !rewardId) {
                    return;
                }

                await this._claimReward(levelId, rewardId, button);
            });
        }
    }

    _handleStoreUpdate() {
        if (!this.store) {
            return;
        }
        const state = this.store.getState();
        const gamification = state?.user?.gamification;
        if (!gamification || gamification === this.lastStoreSnapshot) {
            return;
        }

        this.snapshot = gamification;
        this.lastStoreSnapshot = gamification;
        this._renderFromSnapshot();
    }

    _renderFromSnapshot() {
        if (!this.snapshot) {
            this._renderEmptyStates();
            return;
        }

        this._renderOverview();
        this._renderLifetimeStats();
        this._renderAchievements();
        this._renderUpcomingAchievements();
        this._renderActivityFeed();
        this._renderChallenges();
        this._renderRewards();
    }

    _renderEmptyStates() {
        if (this.elements.overview) {
            this.elements.overview.innerHTML = `
                <div class="gamification-empty-state">
                    <span class="material-symbols-outlined" aria-hidden="true">emoji_events</span>
                    <p>Complete seu primeiro quiz para desbloquear conquistas e acompanhar seu progresso por aqui.</p>
                </div>
            `;
        }
        if (this.elements.achievementGrid) {
            this.elements.achievementGrid.innerHTML = '<p class="placeholder-text">Nenhuma conquista cadastrada ainda.</p>';
        }
        if (this.elements.upcomingList) {
            this.elements.upcomingList.innerHTML = '<li class="placeholder-text">Complete um quiz para revelar suas próximas metas.</li>';
        }
        if (this.elements.recordsList) {
            this.elements.recordsList.innerHTML = '<p class="placeholder-text">Complete alguns quizzes para gerar estatísticas detalhadas.</p>';
        }
        if (this.elements.recordsUpdatedAt) {
            this.elements.recordsUpdatedAt.textContent = '';
            this.elements.recordsUpdatedAt.removeAttribute('title');
        }
        if (this.elements.activityFeed) {
            this.elements.activityFeed.innerHTML = '<li class="placeholder-text">Nenhuma atividade recente registrada.</li>';
        }
        if (this.elements.activeChallengesList) {
            this.elements.activeChallengesList.innerHTML = '<p class="placeholder-text">Nenhum desafio ativo agora. Volte em breve para novas missões!</p>';
        }
        if (this.elements.rewardsAvailableList) {
            this.elements.rewardsAvailableList.innerHTML = '<p class="placeholder-text">Nenhuma recompensa disponível no momento.</p>';
        }
        if (this.elements.rewardsUpcomingList) {
            this.elements.rewardsUpcomingList.innerHTML = '<p class="placeholder-text">Sem recompensas futuras cadastradas.</p>';
        }
        if (this.elements.rewardsClaimedList) {
            this.elements.rewardsClaimedList.innerHTML = '<p class="placeholder-text">Você verá suas recompensas desbloqueadas aqui.</p>';
        }
    }

    _renderOverview() {
        if (!this.elements.overview) {
            return;
        }

        const data = this.snapshot;
        const levelName = data?.level?.nome || 'Comece sua jornada';
        const xpTotal = this._formatNumber(data?.xp_total ?? 0);
        const percent = Math.round(data?.progress?.percent ?? 0);
        const xpIntoLevel = this._formatNumber(data?.progress?.xp_into_level ?? 0);
        const xpToNext = data?.progress?.xp_to_next_level;
        const nextLevelName = data?.next_level?.nome || 'próximo nível';
        const prevLevelName = data?.previous_level?.nome || '—';
        const currentStreak = this._formatNumber(data?.current_streak ?? 0);
        const bestStreak = this._formatNumber(data?.best_streak ?? 0);
        const achievementsUnlocked = this._formatNumber(data?.achievements?.total_unlocked ?? 0);
        const achievementsTotal = this._formatNumber(data?.achievements?.total_available ?? 0);

        const daily = data?.daily_engagement;

        this.elements.overview.innerHTML = `
            <header class="gamification-overview__header">
                <div class="gamification-overview__level-badge">
                    <span class="material-symbols-outlined" aria-hidden="true">workspace_premium</span>
                    <div>
                        <span class="gamification-overview__level-label">Nível atual</span>
                        <strong class="gamification-overview__level-name">${levelName}</strong>
                    </div>
                </div>
                <div class="gamification-overview__xp">
                    <span class="gamification-overview__xp-label">XP total</span>
                    <strong class="gamification-overview__xp-value">${xpTotal}</strong>
                </div>
            </header>
            <div class="gamification-overview__progress" role="group" aria-label="Progresso do nível">
                <div class="gamification-progress-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${percent}">
                    <span style="width: ${percent}%;"></span>
                </div>
                <div class="gamification-progress-meta">
                    <span>${xpIntoLevel} XP dentro do nível</span>
                    <span>${typeof xpToNext === 'number' ? `Faltam ${this._formatNumber(xpToNext)} XP para ${nextLevelName}` : 'Você alcançou o patamar máximo registrado.'}</span>
                </div>
            </div>
            <dl class="gamification-overview__stats">
                <div class="gamification-overview__stat">
                    <dt>Sequência atual</dt>
                    <dd>${currentStreak}</dd>
                </div>
                <div class="gamification-overview__stat">
                    <dt>Melhor sequência</dt>
                    <dd>${bestStreak}</dd>
                </div>
                <div class="gamification-overview__stat">
                    <dt>Conquistas</dt>
                    <dd>${achievementsUnlocked} / ${achievementsTotal}</dd>
                </div>
                <div class="gamification-overview__stat">
                    <dt>Último nível</dt>
                    <dd>${prevLevelName}</dd>
                </div>
            </dl>
            ${daily ? this._renderDailySummary(daily) : ''}
        `;
    }

    _renderDailySummary(daily) {
        const questionsToday = this._formatNumber(daily?.questions_today ?? 0);
        const correctToday = this._formatNumber(daily?.correct_today ?? 0);
        const xpToday = this._formatNumber(daily?.xp_today ?? 0);
        const pointsToday = this._formatNumber(daily?.points_today ?? 0);
        const streakDays = this._formatNumber(daily?.streak_days ?? 0);
        const hasActivity = Boolean(daily?.has_activity_today);

        return `
            <div class="gamification-daily-summary">
                <h3 class="gamification-daily-summary__title">Resumo diário</h3>
                <ul class="gamification-daily-summary__list">
                    <li>
                        <span class="gamification-daily-summary__label">Perguntas</span>
                        <span class="gamification-daily-summary__value">${questionsToday}</span>
                    </li>
                    <li>
                        <span class="gamification-daily-summary__label">Acertos</span>
                        <span class="gamification-daily-summary__value">${correctToday}</span>
                    </li>
                    <li>
                        <span class="gamification-daily-summary__label">XP</span>
                        <span class="gamification-daily-summary__value">${xpToday}</span>
                    </li>
                    <li>
                        <span class="gamification-daily-summary__label">Pontos</span>
                        <span class="gamification-daily-summary__value">${pointsToday}</span>
                    </li>
                    <li>
                        <span class="gamification-daily-summary__label">Sequência diária</span>
                        <span class="gamification-daily-summary__value">${hasActivity ? `${streakDays} dia${streakDays === '1' ? '' : 's'}` : 'Responda hoje para manter a sequência!'}</span>
                    </li>
                </ul>
            </div>
        `;
    }

    _renderLifetimeStats() {
        if (!this.elements.recordsList) {
            return;
        }

        const stats = this.snapshot?.lifetime_stats || {};

        const items = [
            {
                key: 'total_sessions',
                label: 'Quizzes concluídos',
                icon: 'playlist_add_check',
                hint: 'Sessões completas registradas',
            },
            {
                key: 'best_score',
                label: 'Recorde de pontos',
                icon: 'military_tech',
                hint: 'Maior pontuação final registrada',
                suffix: ' pts',
            },
            {
                key: 'best_correct_answers',
                label: 'Maior número de acertos',
                icon: 'checklist_rtl',
                hint: 'Melhor desempenho em uma sessão',
            },
            {
                key: 'rewards_claimed_count',
                label: 'Recompensas resgatadas',
                icon: 'redeem',
                hint: 'Benefícios já utilizados',
            },
            {
                key: 'rewards_available_count',
                label: 'Recompensas pendentes',
                icon: 'card_giftcard',
                hint: 'Prêmios aguardando resgate',
            },
            {
                key: 'xp_today',
                label: 'XP hoje',
                icon: 'auto_graph',
                hint: 'Experiência acumulada nas últimas 24h',
                suffix: ' XP',
                optional: true,
            },
            {
                key: 'daily_points',
                label: 'Pontos do dia',
                icon: 'bolt',
                hint: 'Pontuação somada nas últimas 24h',
                suffix: ' pts',
                optional: true,
            },
        ];

        const cards = items.reduce((acc, item) => {
            const rawValue = stats?.[item.key];
            if (item.optional && (rawValue === null || rawValue === undefined)) {
                return acc;
            }
            const formattedValue = this._formatNumber(rawValue ?? 0);
            const suffix = item.suffix || '';
            const hintHtml = item.hint
                ? `<span class="gamification-record-card__hint">${this._escapeHtml(item.hint)}</span>`
                : '';
            acc.push(`
                <article class="gamification-record-card">
                    <span class="material-symbols-outlined gamification-record-card__icon" aria-hidden="true">${this._escapeHtml(item.icon)}</span>
                    <div class="gamification-record-card__body">
                        <span class="gamification-record-card__label">${this._escapeHtml(item.label)}</span>
                        <strong class="gamification-record-card__value">${formattedValue}${suffix}</strong>
                        ${hintHtml}
                    </div>
                </article>
            `);
            return acc;
        }, []);

        if (cards.length === 0) {
            this.elements.recordsList.innerHTML = '<p class="placeholder-text">Complete alguns quizzes para gerar estatísticas detalhadas.</p>';
        } else {
            this.elements.recordsList.innerHTML = cards.join('');
        }

        if (this.elements.recordsUpdatedAt) {
            const iso = stats?.last_update || null;
            const fallbackDisplay = iso ? this._formatDateTime(iso) : '';
            const displayLabel = stats?.last_update_display || fallbackDisplay;
            if (displayLabel) {
                this.elements.recordsUpdatedAt.textContent = `Atualizado em ${displayLabel}`;
                if (iso) {
                    this.elements.recordsUpdatedAt.setAttribute('title', fallbackDisplay || displayLabel);
                } else {
                    this.elements.recordsUpdatedAt.removeAttribute('title');
                }
            } else {
                this.elements.recordsUpdatedAt.textContent = '';
                this.elements.recordsUpdatedAt.removeAttribute('title');
            }
        }
    }

    _renderActivityFeed() {
        if (!this.elements.activityFeed) {
            return;
        }

        const events = Array.isArray(this.snapshot?.activity_feed)
            ? this.snapshot.activity_feed
            : [];

        if (events.length === 0) {
            this.elements.activityFeed.innerHTML = '<li class="placeholder-text">Nenhuma atividade recente registrada.</li>';
            return;
        }

        const html = events.map((event) => this._renderActivityItem(event)).join('');
        this.elements.activityFeed.innerHTML = html;
    }

    _renderActivityItem(event) {
        const type = event?.type || 'achievement';
        const icon = this._escapeHtml(event?.icon || this._resolveActivityIcon(type));
        const typeLabel = this._translateActivityType(type);
        const dateDisplay = event?.date_display || (event?.date ? this._formatDateTime(event.date) : '');
        const metaSummary = Array.isArray(event?.meta_summary) && event.meta_summary.length > 0
            ? event.meta_summary
            : this._buildActivityMetaFallback(type, event?.metadata);

        const descriptionHtml = event?.description
            ? `<p class="gamification-activity__description">${this._escapeHtml(event.description)}</p>`
            : '';
        const dateHtml = dateDisplay
            ? `<time class="gamification-activity__date">${this._escapeHtml(dateDisplay)}</time>`
            : '';
        const metaHtml = metaSummary.length > 0
            ? `<ul class="gamification-activity__meta">${metaSummary.map((item) => `<li>${this._escapeHtml(item)}</li>`).join('')}</ul>`
            : '';

        return `
            <li class="gamification-activity__item gamification-activity__item--${this._escapeHtml(type)}" data-activity-type="${this._escapeHtml(type)}">
                <span class="material-symbols-outlined gamification-activity__icon" aria-hidden="true">${icon}</span>
                <div class="gamification-activity__content">
                    <div class="gamification-activity__header">
                        <span class="gamification-activity__type">${this._escapeHtml(typeLabel)}</span>
                        ${dateHtml}
                    </div>
                    <strong class="gamification-activity__title">${this._escapeHtml(event?.title || 'Atividade')}</strong>
                    ${descriptionHtml}
                    ${metaHtml}
                </div>
            </li>
        `;
    }

    _resolveActivityIcon(type) {
        switch (type) {
            case 'challenge':
                return 'flag';
            case 'reward':
                return 'redeem';
            default:
                return 'emoji_events';
        }
    }

    _translateActivityType(type) {
        switch (type) {
            case 'challenge':
                return 'Desafio';
            case 'reward':
                return 'Recompensa';
            default:
                return 'Conquista';
        }
    }

    _buildActivityMetaFallback(type, metadata) {
        if (!metadata || typeof metadata !== 'object') {
            return [];
        }

        if (type === 'achievement') {
            const mapping = {
                xp_total: { label: 'XP total', suffix: ' XP' },
                pontuacao: { label: 'Pontuação', suffix: ' pts' },
                acertos: { label: 'Acertos' },
                dias_consecutivos: { label: 'Dias consecutivos', suffix: ' dias' },
                quizzes_completos: { label: 'Quizzes completos' },
                perguntas_diarias: { label: 'Perguntas no dia' },
                xp_diario: { label: 'XP diário', suffix: ' XP' },
                melhor_sequencia: { label: 'Sequência', suffix: ' acertos' },
            };

            return Object.entries(mapping).reduce((acc, [key, config]) => {
                const value = metadata[key];
                if (value === undefined || value === null || value === '') {
                    return acc;
                }
                const formatted = this._formatNumber(value);
                const suffix = config.suffix || '';
                acc.push(`${config.label}: ${formatted}${suffix}`);
                return acc;
            }, []);
        }

        if (type === 'challenge') {
            const summary = [];
            const progressLabel = metadata?.progress?.label || metadata?.label;
            if (progressLabel) {
                summary.push(`Progresso final: ${progressLabel}`);
            }
            const reward = metadata?.reward || {};
            const rewardName = reward?.nome || reward?.valor;
            if (rewardName) {
                summary.push(`Recompensa: ${rewardName}`);
            }
            const raw = metadata?.raw || metadata;
            const lastContribution = raw?.ultima_contribuicao;
            if (lastContribution !== undefined && lastContribution !== null && lastContribution !== '') {
                summary.push(`Última contribuição: ${this._formatNumber(lastContribution)}`);
            }
            return summary;
        }

        if (type === 'reward') {
            const summary = [];
            if (metadata?.level) {
                summary.push(`Nível: ${metadata.level}`);
            }
            const reward = metadata?.reward || {};
            if (reward?.nome) {
                summary.push(`Recompensa: ${reward.nome}`);
            } else if (reward?.valor) {
                summary.push(`Valor: ${reward.valor}`);
            }
            if (reward?.tipo) {
                summary.push(`Tipo: ${reward.tipo}`);
            }
            return summary;
        }

        return [];
    }

    _formatDateTime(value) {
        if (!value) {
            return '';
        }
        try {
            const date = new Date(value);
            if (Number.isNaN(date.getTime())) {
                return value;
            }
            return new Intl.DateTimeFormat('pt-BR', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
            }).format(date);
        } catch (error) {
            return value;
        }
    }

    _escapeHtml(value) {
        if (value === undefined || value === null) {
            return '';
        }
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    _renderAchievements() {
        if (!this.elements.achievementGrid) {
            return;
        }

        const achievements = Array.isArray(this.snapshot?.achievements?.catalog)
            ? this.snapshot.achievements.catalog
            : [];

        const normalizedQuery = this.searchQuery.toLowerCase();
        const filtered = achievements.filter((item) => {
            const status = item?.is_unlocked
                ? 'unlocked'
                : item?.progress
                    ? 'in-progress'
                    : 'locked';
            const matchesFilter = this.currentFilter === 'all' || status === this.currentFilter;
            const searchableText = `${item?.nome || ''} ${item?.descricao || ''}`.toLowerCase();
            const matchesSearch = !normalizedQuery || searchableText.includes(normalizedQuery);
            return matchesFilter && matchesSearch;
        });

        if (filtered.length === 0) {
            this.elements.achievementGrid.innerHTML = '<p class="placeholder-text">Nenhuma conquista encontrada para os filtros selecionados.</p>';
            return;
        }

        const html = filtered.map((item) => this._renderAchievementCard(item)).join('');
        this.elements.achievementGrid.innerHTML = html;
    }

    _renderAchievementCard(item) {
        const status = item?.is_unlocked
            ? 'unlocked'
            : item?.progress
                ? 'in-progress'
                : 'locked';
        const icon = item?.icone || 'emoji_events';
        const unlockedAt = item?.data_conquista ? this._formatDate(item.data_conquista) : null;
        const hasProgress = Boolean(item?.progress);
        const progressPercent = hasProgress ? Math.round(item.progress.percent ?? 0) : 0;
        const progressLabel = hasProgress ? item.progress.label : '';
        const remainingLabel = hasProgress ? item.progress.remaining_label : '';

        return `
            <article class="achievement-card${status === 'unlocked' ? ' is-unlocked' : ''}${hasProgress ? ' has-progress' : ''}" data-achievement-status="${status}">
                <header class="achievement-card__header">
                    <span class="material-symbols-outlined achievement-card__icon" aria-hidden="true">${icon}</span>
                    <div>
                        <h4 class="achievement-card__title">${item?.nome || 'Conquista'}</h4>
                        <p class="achievement-card__description">${item?.descricao || 'Continue respondendo quizzes para desbloquear novas conquistas.'}</p>
                    </div>
                </header>
                <div class="achievement-card__body">
                    ${status === 'unlocked'
                        ? `<p class="achievement-card__status achievement-card__status--unlocked"><span class="material-symbols-outlined" aria-hidden="true">celebration</span>Desbloqueada em ${unlockedAt}</p>`
                        : hasProgress
                            ? `
                                <div class="achievement-progress" role="group" aria-label="Progresso da conquista">
                                    <div class="achievement-progress__bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${progressPercent}">
                                        <span style="width: ${progressPercent}%;"></span>
                                    </div>
                                    <div class="achievement-progress__meta">
                                        <span>${progressLabel}</span>
                                        <span>${remainingLabel}</span>
                                    </div>
                                </div>
                              `
                            : '<p class="achievement-card__status">Ainda não conquistada.</p>'}
                </div>
            </article>
        `;
    }

    _renderUpcomingAchievements() {
        if (!this.elements.upcomingList) {
            return;
        }

        const upcoming = Array.isArray(this.snapshot?.achievements?.upcoming)
            ? this.snapshot.achievements.upcoming
            : [];

        if (upcoming.length === 0) {
            this.elements.upcomingList.innerHTML = '<li class="placeholder-text">Complete mais desafios para revelar novas metas.</li>';
            return;
        }

        const html = upcoming.map((item) => `
            <li class="gamification-achievements__upcoming-item">
                <span class="material-symbols-outlined" aria-hidden="true">flag</span>
                <div>
                    <strong>${item?.nome || 'Próxima meta'}</strong>
                    ${item?.descricao ? `<p>${item.descricao}</p>` : ''}
                    ${item?.progress ? `<span class="gamification-achievements__upcoming-progress">${item.progress.label} • ${item.progress.remaining_label}</span>` : ''}
                </div>
            </li>
        `).join('');

        this.elements.upcomingList.innerHTML = html;
    }

    _renderChallenges() {
        if (!this.elements.activeChallengesList && !this.elements.completedChallengesList) {
            return;
        }

        const active = Array.isArray(this.snapshot?.challenges?.active)
            ? this.snapshot.challenges.active
            : [];
        const completed = Array.isArray(this.snapshot?.challenges?.completed_now)
            ? this.snapshot.challenges.completed_now
            : [];

        if (this.elements.activeChallengesList) {
            if (active.length === 0) {
                this.elements.activeChallengesList.innerHTML = '<p class="placeholder-text">Nenhum desafio ativo agora. Volte em breve para novas missões!</p>';
            } else {
                const html = active.map((item) => this._renderChallengeCard(item)).join('');
                this.elements.activeChallengesList.innerHTML = html;
            }
        }

        if (this.elements.completedChallengesList) {
            if (completed.length === 0) {
                this.elements.completedChallengesList.innerHTML = '<p class="placeholder-text">Finalize um desafio para ver um histórico aqui.</p>';
            } else {
                const html = completed.map((item) => this._renderCompletedChallengeCard(item)).join('');
                this.elements.completedChallengesList.innerHTML = html;
            }
        }

        this._setupChallengeCountdown(active);
    }

    _renderChallengeCard(item) {
        const progressPercent = Math.round(item?.progress?.percent ?? 0);
        const progressLabel = item?.progress?.label || '';
        const remainingUnit = item?.progress?.remaining;
        const unitLabel = item?.metadata?.unidade || 'pontos';
        const timeRemaining = item?.time_remaining_seconds ?? 0;
        const deadlineText = timeRemaining > 0
            ? `Expira em <span data-countdown-text>${this._formatCountdown(timeRemaining)}</span>`
            : 'Disponível';

        return `
            <article class="challenge-card${item?.is_completed ? ' is-completed' : ''}" data-challenge-slug="${item?.slug || ''}" data-time-remaining="${timeRemaining}">
                <header class="challenge-card__header">
                    <div>
                        <h3 class="challenge-card__title">${item?.nome || 'Desafio'}</h3>
                        ${item?.descricao ? `<p class="challenge-card__description">${item.descricao}</p>` : ''}
                    </div>
                    ${item?.reward?.nome || item?.reward?.valor
                        ? `<span class="challenge-card__reward"><span class="material-symbols-outlined" aria-hidden="true">redeem</span>${item.reward.nome || 'Recompensa especial'}</span>`
                        : ''}
                </header>
                <div class="challenge-card__body">
                    <div class="challenge-progress" role="group" aria-label="Progresso do desafio">
                        <div class="challenge-progress__bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${progressPercent}">
                            <span style="width: ${progressPercent}%;"></span>
                        </div>
                        <div class="challenge-progress__meta">
                            <span>${progressLabel}</span>
                            ${typeof remainingUnit === 'number' ? `<span>Faltam ${this._formatNumber(remainingUnit)} ${unitLabel}</span>` : ''}
                        </div>
                    </div>
                    <dl class="challenge-card__stats">
                        <div>
                            <dt>Tipo</dt>
                            <dd>${(item?.tipo || 'desafio').toString()}</dd>
                        </div>
                        <div>
                            <dt>Período</dt>
                            <dd>${this._formatChallengePeriod(item)}</dd>
                        </div>
                        <div>
                            <dt>Status</dt>
                            <dd class="challenge-card__status" data-challenge-status>${item?.is_completed ? 'Concluído' : deadlineText}</dd>
                        </div>
                    </dl>
                </div>
                ${item?.detail_url ? `<footer class="challenge-card__footer"><a class="button button--text button--small" href="${item.detail_url}">Ver detalhes</a></footer>` : ''}
            </article>
        `;
    }

    _renderCompletedChallengeCard(item) {
        const completedAt = item?.completed_at ? this._formatDate(item.completed_at) : null;
        return `
            <article class="challenge-card challenge-card--compact is-completed" data-challenge-slug="${item?.slug || ''}">
                <header class="challenge-card__header">
                    <div>
                        <h4 class="challenge-card__title">${item?.nome || 'Desafio concluído'}</h4>
                        ${item?.descricao ? `<p class="challenge-card__description">${item.descricao}</p>` : ''}
                    </div>
                </header>
                <p class="challenge-card__status">${completedAt ? `Concluído em ${completedAt}` : 'Concluído recentemente'}</p>
            </article>
        `;
    }

    _setupChallengeCountdown(activeChallenges) {
        if (this.challengeIntervalId) {
            clearInterval(this.challengeIntervalId);
            this.challengeIntervalId = null;
        }
        this.challengeTimers = [];

        if (!Array.isArray(activeChallenges) || activeChallenges.length === 0 || !this.elements.activeChallengesList) {
            return;
        }

        activeChallenges.forEach((challenge) => {
            const seconds = Number.parseInt(challenge?.time_remaining_seconds, 10);
            if (!Number.isFinite(seconds) || seconds <= 0) {
                return;
            }
            const selector = `[data-challenge-slug="${challenge?.slug || ''}"] [data-countdown-text]`;
            const node = this.elements.activeChallengesList.querySelector(selector);
            if (node) {
                node.textContent = this._formatCountdown(seconds);
                this.challengeTimers.push({ slug: challenge?.slug, element: node, remaining: seconds });
            }
        });

        if (this.challengeTimers.length === 0) {
            return;
        }

        this.challengeIntervalId = window.setInterval(() => {
            this.challengeTimers = this.challengeTimers.reduce((acc, timer) => {
                const updated = Math.max(timer.remaining - 60, 0);
                timer.remaining = updated;
                if (updated <= 0) {
                    timer.element.textContent = 'Encerrado';
                    const statusContainer = timer.element.closest('[data-challenge-status]');
                    if (statusContainer) {
                        statusContainer.textContent = 'Encerrado';
                    }
                    return acc;
                }
                timer.element.textContent = this._formatCountdown(updated);
                acc.push(timer);
                return acc;
            }, []);

            if (this.challengeTimers.length === 0 && this.challengeIntervalId) {
                clearInterval(this.challengeIntervalId);
                this.challengeIntervalId = null;
            }
        }, 60000);
    }

    _renderRewards() {
        if (!this.elements.rewardsAvailableList && !this.elements.rewardsUpcomingList && !this.elements.rewardsClaimedList) {
            return;
        }

        const rewards = this.snapshot?.rewards || {};
        const available = Array.isArray(rewards.available_to_claim) ? rewards.available_to_claim : [];
        const upcoming = Array.isArray(rewards.upcoming) ? rewards.upcoming : [];
        const claimed = Array.isArray(rewards.claimed) ? rewards.claimed : [];

        if (this.elements.rewardsAvailableList) {
            this.elements.rewardsAvailableList.innerHTML = available.length > 0
                ? available.map((item) => this._renderRewardCard(item, 'available')).join('')
                : '<p class="placeholder-text">Nenhuma recompensa disponível no momento.</p>';
        }

        if (this.elements.rewardsUpcomingList) {
            this.elements.rewardsUpcomingList.innerHTML = upcoming.length > 0
                ? upcoming.map((item) => this._renderRewardCard(item, 'upcoming')).join('')
                : '<p class="placeholder-text">Sem recompensas futuras cadastradas.</p>';
        }

        if (this.elements.rewardsClaimedList) {
            this.elements.rewardsClaimedList.innerHTML = claimed.length > 0
                ? claimed.map((item) => this._renderRewardCard(item, 'claimed')).join('')
                : '<p class="placeholder-text">Você verá suas recompensas desbloqueadas aqui.</p>';
        }

        if (this.elements.rewardsFeedback) {
            this.elements.rewardsFeedback.textContent = '';
            this.elements.rewardsFeedback.classList.remove('is-success', 'is-error');
        }
    }

    _renderRewardCard(item, type = 'available') {
        const levelName = item?.level_name || 'Nível atual';
        const rewardName = item?.name || 'Recompensa';
        const rewardDescription = item?.description || '';
        const value = item?.value;
        const claimedAt = item?.claimed_at ? this._formatDate(item.claimed_at) : null;

        if (type === 'available') {
            return `
                <article class="reward-card" data-level-id="${item?.level_id ?? ''}" data-reward-id="${item?.reward_id ?? ''}">
                    <header class="reward-card__header">
                        <div>
                            <h4 class="reward-card__title">${rewardName}</h4>
                            <p class="reward-card__subtitle">${levelName}</p>
                        </div>
                        <span class="reward-card__badge">${item?.type || 'Bônus'}</span>
                    </header>
                    ${rewardDescription ? `<p class="reward-card__description">${rewardDescription}</p>` : ''}
                    ${value ? `<p class="reward-card__meta">Valor: ${value}</p>` : ''}
                    <button type="button" class="button button--secondary button--small reward-card__action" data-claim-reward>
                        <span class="material-symbols-outlined button__icon" aria-hidden="true">redeem</span>
                        Resgatar
                    </button>
                </article>
            `;
        }

        if (type === 'upcoming') {
            return `
                <article class="reward-card reward-card--upcoming">
                    <header class="reward-card__header">
                        <div>
                            <h4 class="reward-card__title">${rewardName}</h4>
                            <p class="reward-card__subtitle">Disponível em ${levelName}</p>
                        </div>
                        <span class="reward-card__badge">Próximo nível</span>
                    </header>
                    ${rewardDescription ? `<p class="reward-card__description">${rewardDescription}</p>` : ''}
                    ${value ? `<p class="reward-card__meta">Valor previsto: ${value}</p>` : ''}
                </article>
            `;
        }

        return `
            <article class="reward-card reward-card--claimed">
                <header class="reward-card__header">
                    <div>
                        <h4 class="reward-card__title">${rewardName}</h4>
                        <p class="reward-card__subtitle">${levelName}</p>
                    </div>
                    <span class="reward-card__badge">Resgatada</span>
                </header>
                ${rewardDescription ? `<p class="reward-card__description">${rewardDescription}</p>` : ''}
                ${claimedAt ? `<p class="reward-card__meta">Resgatada em ${claimedAt}</p>` : ''}
            </article>
        `;
    }

    async _claimReward(levelId, rewardId, button) {
        if (!this.actionOrchestrator) {
            return;
        }

        const originalLabel = button.textContent;
        button.disabled = true;
        button.textContent = 'Resgatando...';

        try {
            const response = await this.actionOrchestrator.claimLevelReward(levelId, rewardId);
            if (!response || response.status !== 'success') {
                throw new Error(response?.message || 'Não foi possível resgatar a recompensa.');
            }

            if (response.gamificacao) {
                this.snapshot = response.gamificacao;
                this.lastStoreSnapshot = response.gamificacao;
            }

            this._renderFromSnapshot();
            this._showRewardsFeedback('Recompensa resgatada com sucesso! Aproveite o benefício.', 'success');
        } catch (error) {
            console.error('GamificationDashboard: erro ao resgatar recompensa.', error);
            this._showRewardsFeedback(error?.message || 'Não foi possível resgatar a recompensa.', 'error');
        } finally {
            button.disabled = false;
            button.textContent = originalLabel;
        }
    }

    _showRewardsFeedback(message, type = 'info') {
        if (!this.elements.rewardsFeedback) {
            return;
        }
        this.elements.rewardsFeedback.textContent = message;
        this.elements.rewardsFeedback.classList.remove('is-success', 'is-error');
        if (type === 'success') {
            this.elements.rewardsFeedback.classList.add('is-success');
        } else if (type === 'error') {
            this.elements.rewardsFeedback.classList.add('is-error');
        }
    }

    _updateFilterButtons(activeButton) {
        if (!this.elements.filterGroup) {
            return;
        }
        const buttons = Array.from(this.elements.filterGroup.querySelectorAll('[data-achievements-filter]'));
        buttons.forEach((btn) => {
            if (btn === activeButton) {
                btn.classList.add('is-active');
            } else {
                btn.classList.remove('is-active');
            }
        });
    }

    _formatNumber(value) {
        const number = Number(value);
        if (!Number.isFinite(number)) {
            return '0';
        }
        return number.toLocaleString('pt-BR');
    }

    _formatDate(dateString) {
        try {
            const date = new Date(dateString);
            if (Number.isNaN(date.getTime())) {
                return dateString;
            }
            return new Intl.DateTimeFormat('pt-BR').format(date);
        } catch (error) {
            return dateString;
        }
    }

    _formatChallengePeriod(item) {
        const start = item?.start ? this._formatDate(item.start) : null;
        const end = item?.end ? this._formatDate(item.end) : null;
        if (start && end) {
            return `${start} - ${end}`;
        }
        if (start) {
            return `A partir de ${start}`;
        }
        if (end) {
            return `Até ${end}`;
        }
        return 'Período dinâmico';
    }

    _formatCountdown(seconds) {
        if (!Number.isFinite(seconds) || seconds <= 0) {
            return 'menos de 1 min';
        }
        const days = Math.floor(seconds / 86400);
        const hours = Math.floor((seconds % 86400) / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);

        const parts = [];
        if (days > 0) {
            parts.push(`${days}d`);
        }
        if (hours > 0) {
            parts.push(`${hours}h`);
        }
        if (days === 0 && minutes > 0) {
            parts.push(`${minutes}min`);
        }

        return parts.length > 0 ? parts.join(' ') : 'menos de 1 min';
    }
}
