// File: assets/js/ui/GamificationPanelManager.js

export default class GamificationPanelManager {
    constructor(apiService) {
        this.apiService = apiService;
        this.panels = [];
    }

    init() {
        if (typeof document === 'undefined') {
            return;
        }

        this.panels = Array.from(document.querySelectorAll('[data-gamification-panel]'));
        if (this.panels.length === 0) {
            return;
        }

        this.panels.forEach((panel) => this._setupPanel(panel));
    }

    _setupPanel(panel) {
        if (!panel) {
            return;
        }

        panel.addEventListener('click', (event) => {
            const claimButton = event.target.closest('[data-gamification-claim-button]');
            if (!claimButton || claimButton.disabled) {
                return;
            }

            event.preventDefault();
            this._handleClaim(panel, claimButton);
        });
    }

    async _handleClaim(panel, button) {
        const levelId = Number(button?.dataset?.levelId);
        const rewardId = button?.dataset?.rewardId;
        if (!Number.isFinite(levelId) || !rewardId) {
            return;
        }

        const originalLabel = button.textContent?.trim() || 'Resgatar';
        this._setButtonLoading(button, true);

        try {
            const response = await this.apiService.claimLevelReward(levelId, rewardId);
            this._showFeedback(panel, 'Recompensa resgatada com sucesso!', 'success');

            if (response?.gamificacao) {
                this._updatePanelSnapshot(panel, response.gamificacao);
            }

            if (response?.rewards_state) {
                this._renderRewards(panel, response.rewards_state);
            }

            this._setButtonLoading(button, false, originalLabel, true);
        } catch (error) {
            const message = error?.data?.message || error?.message || 'Não foi possível resgatar a recompensa.';
            this._showFeedback(panel, message, 'error');
            this._setButtonLoading(button, false, originalLabel);
        }
    }

    _setButtonLoading(button, isLoading, fallbackLabel = null, disablePermanently = false) {
        if (!button) {
            return;
        }

        if (isLoading) {
            button.disabled = true;
            if (!button.dataset.originalLabel) {
                button.dataset.originalLabel = button.textContent?.trim() || '';
            }
            button.classList.add('is-loading');
            button.textContent = 'Processando...';
            return;
        }

        button.classList.remove('is-loading');
        button.disabled = Boolean(disablePermanently);
        const label = disablePermanently
            ? 'Resgatado'
            : (fallbackLabel || button.dataset.originalLabel || 'Resgatar');
        button.textContent = label;

        if (!disablePermanently) {
            delete button.dataset.originalLabel;
        }
    }

    _showFeedback(panel, message, tone) {
        const feedback = panel.querySelector('[data-gamification-feedback]');
        if (!feedback) {
            return;
        }

        feedback.textContent = message;
        feedback.classList.remove('is-success', 'is-error');
        if (tone === 'success') {
            feedback.classList.add('is-success');
        } else if (tone === 'error') {
            feedback.classList.add('is-error');
        }
    }

    _updatePanelSnapshot(panel, snapshot) {
        if (!snapshot || !panel) {
            return;
        }

        const context = panel.dataset.panelContext || 'home';
        const xpTotalEl = panel.querySelector('[data-gamification-xp-total]');
        if (xpTotalEl) {
            xpTotalEl.textContent = `${this._formatNumber(snapshot.xp_total || 0)} XP`;
        }

        const challengesSnapshot = snapshot.challenges || {};
        const totalActiveChallenges = Number.isFinite(challengesSnapshot.total_active)
            ? challengesSnapshot.total_active
            : (Array.isArray(challengesSnapshot.active) ? challengesSnapshot.active.length : 0);
        this._updateHighlightValue('active-challenges', totalActiveChallenges);

        const rewardsSnapshot = snapshot.rewards || {};
        const availableRewardsCount = Array.isArray(rewardsSnapshot.available_to_claim)
            ? rewardsSnapshot.available_to_claim.length
            : Number(rewardsSnapshot.available_to_claim_count) || 0;
        this._updateHighlightValue('available-rewards', availableRewardsCount, { toggleHighlight: true });

        const levelNameEl = panel.querySelector('[data-gamification-level-name]');
        if (levelNameEl) {
            const levelName = snapshot.level?.nome;
            levelNameEl.textContent = levelName ? `Nível atual: ${levelName}` : 'Sem nível definido ainda';
        }

        const progress = snapshot.progress || {};
        const percent = Number.isFinite(progress.percent) ? Math.max(0, Math.min(progress.percent, 100)) : 0;
        const progressBar = panel.querySelector('[data-gamification-progress-bar]');
        if (progressBar) {
            progressBar.setAttribute('aria-valuenow', percent.toFixed(0));
        }
        const progressFill = panel.querySelector('[data-gamification-progress-fill]');
        if (progressFill) {
            progressFill.style.width = `${percent}%`;
        }

        const progressLabel = panel.querySelector('[data-gamification-progress-label]');
        if (progressLabel) {
            const xpInto = this._formatNumber(progress.xp_into_level || 0);
            if (progress.xp_range_end != null && progress.xp_range_start != null) {
                const totalForLevel = Math.max(0, (progress.xp_range_end || 0) - (progress.xp_range_start || 0));
                progressLabel.textContent = `${xpInto} XP neste nível`;
                if (totalForLevel > 0) {
                    progressLabel.textContent = `${xpInto} XP neste nível`;
                }
            } else {
                progressLabel.textContent = `${xpInto} XP acumulados`;
            }
        }

        const xpNextEl = panel.querySelector('[data-gamification-xp-next]');
        if (xpNextEl) {
            if (progress.xp_to_next_level != null && snapshot.next_level?.nome) {
                xpNextEl.textContent = `${this._formatNumber(progress.xp_to_next_level)} XP para ${snapshot.next_level.nome}`;
            } else if (snapshot.next_level?.nome) {
                xpNextEl.textContent = `Pronto para ${snapshot.next_level.nome}`;
            } else {
                xpNextEl.textContent = 'Nível máximo alcançado';
            }
        }

        const currentStreakEl = panel.querySelectorAll('[data-gamification-current-streak]');
        currentStreakEl.forEach((el) => {
            el.textContent = this._formatNumber(snapshot.current_streak || 0);
        });

        const achievementCountEls = panel.querySelectorAll('[data-gamification-achievement-count]');
        const unlocked = snapshot.achievements?.total_unlocked || 0;
        const available = snapshot.achievements?.total_available || 0;
        achievementCountEls.forEach((el) => {
            const hasSlash = el.textContent.includes('/');
            if (hasSlash) {
                el.textContent = `${this._formatNumber(unlocked)} / ${this._formatNumber(available)}`;
            } else {
                const plural = unlocked === 1 ? 'desbloqueada' : 'desbloqueadas';
                el.textContent = `${this._formatNumber(unlocked)} ${plural}`;
            }
        });

        this._updateDailySnapshot(panel, snapshot, context);
    }

    _updateDailySnapshot(panel, snapshot, context) {
        const daily = snapshot.daily_engagement || {};
        const questionsValue = daily.questions_today || 0;
        const xpValue = daily.xp_today || 0;
        const streakValue = daily.streak_days || 0;
        const questionsEl = panel.querySelector('[data-gamification-daily-questions]');
        if (questionsEl) {
            questionsEl.textContent = this._formatNumber(questionsValue);
        }
        this._updateHighlightValue('daily-questions', questionsValue);

        const xpEl = panel.querySelector('[data-gamification-daily-xp]');
        if (xpEl) {
            const xpText = this._formatNumber(xpValue);
            xpEl.textContent = context === 'home' ? `${xpText} XP` : xpText;
        }
        this._updateHighlightValue('daily-xp', xpValue);

        const streakEl = panel.querySelector('[data-gamification-daily-streak]');
        if (streakEl) {
            if (context === 'home') {
                streakEl.textContent = `${this._formatNumber(streakValue)} dia${streakValue === 1 ? '' : 's'}`;
            } else {
                streakEl.textContent = this._formatNumber(streakValue);
            }
        }
        this._updateHighlightValue('daily-streak', streakValue);

        const statusEl = panel.querySelector('[data-gamification-daily-status]');
        if (statusEl) {
            if (daily.has_activity_today) {
                statusEl.textContent = context === 'home'
                    ? 'Meta diária concluída. Excelente!'
                    : 'Meta diária cumprida hoje. Parabéns!';
                statusEl.classList.remove('is-inactive');
            } else {
                statusEl.textContent = context === 'home'
                    ? 'Responda pelo menos uma pergunta para manter sua sequência ativa.'
                    : 'Nenhuma atividade hoje. Jogue para manter a sequência!';
                statusEl.classList.add('is-inactive');
            }
        }
    }

    _renderRewards(panel, rewardsState) {
        if (!panel) {
            return;
        }

        const available = Array.isArray(rewardsState?.available_to_claim)
            ? rewardsState.available_to_claim
            : [];
        const upcoming = Array.isArray(rewardsState?.upcoming)
            ? rewardsState.upcoming
            : [];
        const claimed = Array.isArray(rewardsState?.claimed)
            ? rewardsState.claimed
            : [];

        this._updateHighlightValue('available-rewards', available.length, { toggleHighlight: true });

        this._updateRewardCount(panel, available.length);
        this._renderRewardList(
            panel,
            '[data-gamification-rewards-available-list]',
            '[data-gamification-rewards-available-empty]',
            available,
            { allowClaim: true }
        );
        this._renderRewardList(
            panel,
            '[data-gamification-rewards-upcoming-list]',
            '[data-gamification-rewards-upcoming-empty]',
            upcoming,
            { allowClaim: false }
        );
        this._renderRewardList(
            panel,
            '[data-gamification-rewards-claimed-list]',
            null,
            claimed,
            { allowClaim: false, markClaimed: true }
        );
    }

    _renderRewardList(panel, listSelector, emptySelector, rewards, options = {}) {
        const listEl = panel.querySelector(listSelector);
        const emptyEl = emptySelector ? panel.querySelector(emptySelector) : null;
        if (!listEl) {
            if (emptyEl && emptySelector) {
                emptyEl.classList.remove('u-is-hidden');
            }
            return;
        }

        listEl.innerHTML = '';
        if (!rewards || rewards.length === 0) {
            if (emptyEl) {
                emptyEl.classList.remove('u-is-hidden');
            }
            return;
        }

        if (emptyEl) {
            emptyEl.classList.add('u-is-hidden');
        }

        rewards.forEach((reward) => {
            if (!reward) {
                return;
            }
            const item = document.createElement('li');
            item.className = 'gamification-reward';
            if (options.markClaimed) {
                item.classList.add('gamification-reward--claimed');
            } else if (!options.allowClaim) {
                item.classList.add('gamification-reward--upcoming');
            }

            const info = document.createElement('div');
            info.className = 'gamification-reward__info';

            const title = document.createElement('strong');
            title.textContent = reward.name || 'Recompensa';
            info.appendChild(title);

            if (reward.description) {
                const desc = document.createElement('p');
                desc.textContent = reward.description;
                info.appendChild(desc);
            }

            const level = document.createElement('span');
            level.className = 'gamification-reward__level';
            const levelLabel = reward.level_name ? reward.level_name : reward.level_identifier;
            if (options.markClaimed && reward.claimed_at) {
                level.textContent = `Resgatada em ${this._formatDate(reward.claimed_at)}`;
            } else if (levelLabel) {
                level.textContent = options.allowClaim ? `Nível ${levelLabel}` : `Disponível no ${levelLabel}`;
            }
            info.appendChild(level);

            item.appendChild(info);

            if (options.allowClaim) {
                const button = document.createElement('button');
                button.className = 'button button--secondary button--small gamification-reward__button';
                button.dataset.gamificationClaimButton = 'true';
                button.dataset.levelId = reward.level_id;
                button.dataset.rewardId = reward.reward_id;
                button.textContent = 'Resgatar';
                item.appendChild(button);
            }

            listEl.appendChild(item);
        });
    }

    _updateRewardCount(panel, availableCount) {
        const summaryEl = panel.querySelector('[data-gamification-rewards-summary]');
        if (summaryEl) {
            if (availableCount > 0) {
                const plural = availableCount === 1 ? 'disponível' : 'disponíveis';
                summaryEl.textContent = `${this._formatNumber(availableCount)} ${plural} para resgatar`;
            } else {
                summaryEl.textContent = 'Alcance novos níveis para desbloquear prêmios.';
            }
        }

        const badgeEls = panel.querySelectorAll('[data-gamification-rewards-count]');
        badgeEls.forEach((badge) => {
            badge.textContent = this._formatNumber(availableCount);
        });
    }

    _updateHighlightValue(key, rawValue, options = {}) {
        if (typeof document === 'undefined' || !key) {
            return;
        }

        const elements = document.querySelectorAll(`[data-gamification-highlight="${key}"]`);
        if (!elements.length) {
            return;
        }

        const numericValue = Number(rawValue || 0);
        const suffix = options.suffix ?? '';
        const formatted = this._formatNumber(numericValue);
        const displayValue = `${formatted}${suffix}`;

        elements.forEach((element) => {
            element.textContent = displayValue;
            if (options.toggleHighlight) {
                const parentCard = element.closest('.stat-card');
                if (parentCard) {
                    parentCard.classList.toggle('stat-card--has-value', numericValue > 0);
                }
            }
        });
    }

    _formatNumber(value) {
        return Number(value || 0).toLocaleString('pt-BR');
    }

    _formatDate(dateString) {
        try {
            const parsed = new Date(dateString);
            if (Number.isNaN(parsed.getTime())) {
                return dateString;
            }
            return parsed.toLocaleDateString('pt-BR');
        } catch (error) {
            return dateString;
        }
    }
}
