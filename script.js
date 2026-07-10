/* ============================================================
   游戏活动运营数据小助手 - 主逻辑脚本
   功能：数据校验、指标计算、评级判定、复盘生成、DOM 操作
   ============================================================ */

// ===== DOM 元素引用 =====
const DOM = {
  // 基础信息
  activityName: document.getElementById('activityName'),
  activityType: document.getElementById('activityType'),
  targetUser: document.getElementById('targetUser'),
  activityGoal: document.getElementById('activityGoal'),
  activityPeriod: document.getElementById('activityPeriod'),
  // 数据录入
  exposureCount: document.getElementById('exposureCount'),
  participantCount: document.getElementById('participantCount'),
  completionCount: document.getElementById('completionCount'),
  rewardClaimCount: document.getElementById('rewardClaimCount'),
  returnCount: document.getElementById('returnCount'),
  totalCost: document.getElementById('totalCost'),
  // 按钮
  btnSample: document.getElementById('btnSample'),
  btnGenerate: document.getElementById('btnGenerate'),
  btnClear: document.getElementById('btnClear'),
  // 游戏模板
  gameTemplate: document.getElementById('gameTemplate'),
  btnLoadTemplate: document.getElementById('btnLoadTemplate'),
  // 显示区域
  alertArea: document.getElementById('alertArea'),
  alertMessages: document.getElementById('alertMessages'),
  metricsSection: document.getElementById('metricsSection'),
  metricsCards: document.getElementById('metricsCards'),
  ratingSection: document.getElementById('ratingSection'),
  ratingCard: document.getElementById('ratingCard'),
  reviewSection: document.getElementById('reviewSection'),
  reviewContent: document.getElementById('reviewContent'),
};

// ===== 工具函数 =====

/** 获取数字输入框的值，NaN 视为 null */
function getNumberValue(el) {
  const val = parseInt(el.value, 10);
  return isNaN(val) ? null : val;
}

/** 获取字符串输入框的值，空字符串视为 null */
function getStringValue(el) {
  const val = el.value.trim();
  return val === '' ? null : val;
}

/** 安全除法，分母为 0 时返回 null */
function safeDivide(numerator, denominator) {
  if (denominator === 0 || denominator === null || numerator === null) return null;
  return numerator / denominator;
}

/** 格式化为百分比字符串（保留两位小数） */
function formatPercent(value) {
  if (value === null) return '—';
  return (value * 100).toFixed(2) + '%';
}

/** 格式化为金额字符串（保留两位小数） */
function formatCost(value) {
  if (value === null) return '—';
  return value.toFixed(2);
}

// ===== 数据收集 =====

/** 收集所有表单数据 */
function collectFormData() {
  return {
    activityName: getStringValue(DOM.activityName),
    activityType: getStringValue(DOM.activityType),
    targetUser: getStringValue(DOM.targetUser),
    activityGoal: getStringValue(DOM.activityGoal),
    activityPeriod: getStringValue(DOM.activityPeriod),
    exposureCount: getNumberValue(DOM.exposureCount),
    participantCount: getNumberValue(DOM.participantCount),
    completionCount: getNumberValue(DOM.completionCount),
    rewardClaimCount: getNumberValue(DOM.rewardClaimCount),
    returnCount: getNumberValue(DOM.returnCount),
    totalCost: getNumberValue(DOM.totalCost),
  };
}

// ===== 数据校验 =====

/** 校验数据，返回 { valid: boolean, errors: string[], warnings: string[] } */
function validateData(data) {
  const errors = [];
  const warnings = [];

  // 检查数字字段是否为空
  const numberFields = [
    { key: 'exposureCount', label: '曝光人数' },
    { key: 'participantCount', label: '参与人数' },
    { key: 'completionCount', label: '完成人数' },
    { key: 'rewardClaimCount', label: '奖励领取人数' },
    { key: 'returnCount', label: '次日回访人数' },
    { key: 'totalCost', label: '活动总成本' },
  ];

  for (const field of numberFields) {
    if (data[field.key] === null) {
      errors.push(`「${field.label}」不能为空，请输入数值。`);
    } else if (data[field.key] < 0) {
      errors.push(`「${field.label}」不能小于 0，请检查输入。`);
    }
  }

  // 如果有必填错误，直接返回，不继续检查逻辑关系
  if (errors.length > 0) {
    return { valid: false, errors, warnings };
  }

  const { exposureCount, participantCount, completionCount, rewardClaimCount, returnCount, totalCost } = data;

  // 分母为 0 检查
  if (exposureCount === 0) {
    errors.push('曝光人数为 0，无法计算参与率，请检查输入。');
  }
  if (participantCount === 0) {
    errors.push('参与人数为 0，无法计算完成率、次日回访率和人均成本，请检查输入。');
  }
  if (completionCount === 0) {
    errors.push('完成人数为 0，无法计算奖励领取率，请检查输入。');
  }

  // 逻辑关系异常检查
  if (participantCount > exposureCount) {
    warnings.push('数据可能异常：参与人数不能大于曝光人数，请检查输入。');
  }
  if (completionCount > participantCount) {
    warnings.push('数据可能异常：完成人数不能大于参与人数，请检查输入。');
  }
  if (rewardClaimCount > completionCount) {
    warnings.push('数据可能异常：奖励领取人数不能大于完成人数，请检查输入。');
  }
  if (returnCount > participantCount) {
    warnings.push('数据可能异常：次日回访人数不能大于参与人数，请检查输入。');
  }

  return { valid: errors.length === 0, errors, warnings };
}

// ===== 指标计算 =====

/** 计算所有运营指标 */
function calculateMetrics(data) {
  const { exposureCount, participantCount, completionCount, rewardClaimCount, returnCount, totalCost } = data;

  return {
    participationRate: safeDivide(participantCount, exposureCount),
    completionRate: safeDivide(completionCount, participantCount),
    rewardClaimRate: safeDivide(rewardClaimCount, completionCount),
    returnRate: safeDivide(returnCount, participantCount),
    avgCost: safeDivide(totalCost, participantCount),
  };
}

// ===== 指标状态判定 =====

/** 根据指标值返回状态标签 { label: string, className: string } */
function getMetricStatus(metricName, value) {
  if (value === null) return { label: '无法计算', className: 'neutral' };

  const thresholds = {
    participationRate: [
      { min: 0.40, label: '优秀', className: 'excellent' },
      { min: 0.20, label: '正常', className: 'normal' },
      { min: 0,    label: '需优化', className: 'warning' },
    ],
    completionRate: [
      { min: 0.75, label: '优秀', className: 'excellent' },
      { min: 0.50, label: '正常', className: 'normal' },
      { min: 0,    label: '需优化', className: 'warning' },
    ],
    rewardClaimRate: [
      { min: 0.85, label: '优秀', className: 'excellent' },
      { min: 0.70, label: '正常', className: 'normal' },
      { min: 0,    label: '需优化', className: 'warning' },
    ],
    returnRate: [
      { min: 0.35, label: '优秀', className: 'excellent' },
      { min: 0.25, label: '正常', className: 'normal' },
      { min: 0,    label: '需优化', className: 'warning' },
    ],
  };

  // 人均成本：反向判断，越低越好
  if (metricName === 'avgCost') {
    if (value <= 2) return { label: '优秀', className: 'excellent' };
    if (value <= 5) return { label: '正常', className: 'normal' };
    return { label: '偏高', className: 'warning' };
  }

  const rules = thresholds[metricName];
  if (!rules) return { label: '—', className: 'neutral' };

  for (const rule of rules) {
    if (value >= rule.min) {
      return { label: rule.label, className: rule.className };
    }
  }
  return { label: '—', className: 'neutral' };
}

// ===== 综合评级 =====

/** 根据指标计算综合评级 */
function calculateRating(metrics) {
  const p = metrics.participationRate;
  const c = metrics.completionRate;
  const r = metrics.returnRate;

  if (p === null && c === null && r === null) {
    return { grade: '—', reason: '数据不足，无法评级。', verdict: '请补充完整数据后再进行评级。' };
  }

  const pVal = p ?? 0;
  const cVal = c ?? 0;
  const rVal = r ?? 0;

  if (pVal >= 0.40 && cVal >= 0.60 && rVal >= 0.35) {
    return {
      grade: 'A',
      reason: '参与率、完成率和次日回访率均达到优秀水平。',
      verdict: '活动整体表现优秀，各项指标均衡，说明活动机制和奖励设计非常有效，建议复盘总结成功经验用于后续活动。',
    };
  }

  if (pVal >= 0.25 && cVal >= 0.50 && rVal >= 0.25) {
    return {
      grade: 'B',
      reason: '参与率、完成率和次日回访率达到良好水平。',
      verdict: '活动具备一定吸引力，但对玩家持续回访的带动仍有提升空间。',
    };
  }

  if (pVal >= 0.15 && cVal >= 0.40) {
    return {
      grade: 'C',
      reason: '参与率和完成率处于及格水平，但仍有较大优化空间。',
      verdict: '活动基本达到预期目标，但在入口曝光、任务设计和奖励吸引力方面需要重点优化。',
    };
  }

  return {
    grade: 'D',
    reason: '多项指标未达到基本标准，活动效果不理想。',
    verdict: '活动整体表现不佳，建议重新审视活动定位、奖励设计、入口曝光和用户触达策略。',
  };
}

// ===== 复盘文案生成 =====

/** 生成复盘报告 HTML */
function generateReviewHTML(data, metrics, rating) {
  const pRate = metrics.participationRate;
  const cRate = metrics.completionRate;
  const rcRate = metrics.rewardClaimRate;
  const rRate = metrics.returnRate;
  const avgCost = metrics.avgCost;

  const activityName = data.activityName || '（未命名活动）';
  const activityType = data.activityType || '（未选择）';
  const targetUser = data.targetUser || '（未选择）';
  const activityGoal = data.activityGoal || '（未选择）';
  const activityPeriod = data.activityPeriod || '（未填写）';

  // 数据表现总结
  const dataSummary = `
    <p>本次活动「<strong>${activityName}</strong>」为${activityType}，主要面向${targetUser}，目标是${activityGoal}，活动周期为${activityPeriod}。</p>
    <p>活动期间，曝光人数 <strong>${data.exposureCount.toLocaleString()}</strong> 人，参与人数 <strong>${data.participantCount.toLocaleString()}</strong> 人，完成人数 <strong>${data.completionCount.toLocaleString()}</strong> 人，奖励领取人数 <strong>${data.rewardClaimCount.toLocaleString()}</strong> 人，次日回访人数 <strong>${data.returnCount.toLocaleString()}</strong> 人，活动总成本 <strong>${data.totalCost.toLocaleString()}</strong>。</p>
  `;

  // 指标分析
  const indicatorAnalysis = buildIndicatorAnalysis(pRate, cRate, rcRate, rRate, avgCost);

  // 优化建议
  const suggestions = buildSuggestions(pRate, cRate, rcRate, rRate, avgCost, rating);

  return `
    <h3>一、活动基本情况</h3>
    ${dataSummary}

    <h3>二、数据表现总结</h3>
    ${dataSummary}

    <h3>三、指标分析</h3>
    ${indicatorAnalysis}

    <h3>四、优化建议</h3>
    ${suggestions}
  `;
}

/** 构建指标分析 HTML */
function buildIndicatorAnalysis(pRate, cRate, rcRate, rRate, avgCost) {
  const lines = [];

  // 参与率
  const pStatus = getMetricStatus('participationRate', pRate);
  lines.push(`<li><strong>参与率：</strong>${formatPercent(pRate)}，状态：${pStatus.label}。${getParticipationRateComment(pRate)}</li>`);

  // 完成率
  const cStatus = getMetricStatus('completionRate', cRate);
  lines.push(`<li><strong>完成率：</strong>${formatPercent(cRate)}，状态：${cStatus.label}。${getCompletionRateComment(cRate)}</li>`);

  // 奖励领取率
  const rcStatus = getMetricStatus('rewardClaimRate', rcRate);
  lines.push(`<li><strong>奖励领取率：</strong>${formatPercent(rcRate)}，状态：${rcStatus.label}。${getRewardClaimRateComment(rcRate)}</li>`);

  // 次日回访率
  const rStatus = getMetricStatus('returnRate', rRate);
  lines.push(`<li><strong>次日回访率：</strong>${formatPercent(rRate)}，状态：${rStatus.label}。${getReturnRateComment(rRate)}</li>`);

  // 人均成本
  const costStatus = getMetricStatus('avgCost', avgCost);
  lines.push(`<li><strong>人均活动成本：</strong>${formatCost(avgCost)}，状态：${costStatus.label}。${getAvgCostComment(avgCost)}</li>`);

  return `<ul>${lines.join('')}</ul>`;
}

/** 参与率评论 */
function getParticipationRateComment(rate) {
  if (rate === null) return '无法计算，请检查曝光人数和参与人数。';
  if (rate >= 0.40) return '参与率表现优秀，说明活动入口曝光和奖励吸引力较好。';
  if (rate >= 0.20) return '参与率表现正常，还有提升空间，可优化入口位置和奖励展示。';
  return '参与率偏低，活动入口曝光不足或奖励吸引力不够，需要重点优化。';
}

/** 完成率评论 */
function getCompletionRateComment(rate) {
  if (rate === null) return '无法计算，请检查参与人数和完成人数。';
  if (rate >= 0.75) return '完成率表现优秀，任务难度和活动流程设计合理。';
  if (rate >= 0.50) return '完成率表现正常，部分玩家在任务中途流失，可适当降低任务难度。';
  return '完成率偏低，任务门槛可能偏高，建议降低任务难度或拆分任务阶段。';
}

/** 奖励领取率评论 */
function getRewardClaimRateComment(rate) {
  if (rate === null) return '无法计算，请检查完成人数和奖励领取人数。';
  if (rate >= 0.85) return '奖励领取率表现优秀，领取流程清晰顺畅。';
  if (rate >= 0.70) return '奖励领取率表现正常，建议进一步优化领取提醒和按钮位置。';
  return '奖励领取率偏低，领取流程可能不够清晰，建议增加领取提醒和简化领取步骤。';
}

/** 次日回访率评论 */
function getReturnRateComment(rate) {
  if (rate === null) return '无法计算，请检查参与人数和次日回访人数。';
  if (rate >= 0.35) return '次日回访率表现优秀，活动对玩家持续活跃的带动效果显著。';
  if (rate >= 0.25) return '次日回访率表现正常，对后续活跃有一定带动，但仍有提升空间。';
  return '次日回访率偏低，活动对持续活跃带动不足，建议增加连续登录奖励或限时提醒。';
}

/** 人均成本评论 */
function getAvgCostComment(cost) {
  if (cost === null) return '无法计算，请检查参与人数和活动总成本。';
  if (cost <= 2) return '人均成本控制优秀，投入产出比良好。';
  if (cost <= 5) return '人均成本处于正常范围，可继续关注投入产出比。';
  return '人均成本偏高，建议优化奖励结构，将高价值奖励投放给更关键的用户群体。';
}

/** 构建优化建议 HTML */
function buildSuggestions(pRate, cRate, rcRate, rRate, avgCost, rating) {
  const suggestions = [];

  if (pRate !== null && pRate < 0.20) {
    suggestions.push('<li>活动入口曝光不足或奖励吸引力不够，建议优化活动入口位置、弹窗提醒和奖励展示。</li>');
  }
  if (cRate !== null && cRate < 0.50) {
    suggestions.push('<li>任务门槛可能偏高，建议降低任务难度、拆分任务阶段或增加过程奖励。</li>');
  }
  if (rcRate !== null && rcRate < 0.70) {
    suggestions.push('<li>奖励领取流程可能不够清晰，建议增加领取提醒、优化按钮位置或减少领取步骤。</li>');
  }
  if (rRate !== null && rRate < 0.30) {
    suggestions.push('<li>活动对持续活跃带动不足，建议增加连续登录奖励、次日任务、阶段性奖励或限时提醒。</li>');
  }
  if (avgCost !== null && avgCost > 5) {
    suggestions.push('<li>人均成本较高，需要关注奖励投入产出比，建议优化奖励结构，把高价值奖励投放给更关键的用户群体。</li>');
  }

  // 整体表现较好时给出正向评价
  if (rating.grade === 'A' || rating.grade === 'B') {
    suggestions.push('<li>本次活动整体表现较稳定，说明活动机制和奖励设计具备一定有效性，后续可以在用户分层和长期留存上继续优化。</li>');
  }

  if (suggestions.length === 0) {
    suggestions.push('<li>暂无明显需要优化的项目，建议保持当前活动设计并持续关注数据变化。</li>');
  }

  return `<ul>${suggestions.join('')}</ul>`;
}

// ===== DOM 渲染 =====

/** 显示异常提示 */
function showAlerts(errors, warnings) {
  const allMessages = [...errors, ...warnings];

  if (allMessages.length === 0) {
    DOM.alertArea.classList.add('hidden');
    return;
  }

  DOM.alertMessages.innerHTML = allMessages
    .map((msg) => `<div class="alert-message-item">${msg}</div>`)
    .join('');
  DOM.alertArea.classList.remove('hidden');
}

/** 隐藏异常提示 */
function hideAlerts() {
  DOM.alertArea.classList.add('hidden');
  DOM.alertMessages.innerHTML = '';
}

/** 渲染指标看板 */
function renderMetrics(metrics) {
  const metricDefs = [
    {
      name: '参与率',
      value: formatPercent(metrics.participationRate),
      desc: '衡量活动入口和奖励吸引力',
      status: getMetricStatus('participationRate', metrics.participationRate),
      valueClass: '',
    },
    {
      name: '完成率',
      value: formatPercent(metrics.completionRate),
      desc: '衡量任务难度和活动流程是否合理',
      status: getMetricStatus('completionRate', metrics.completionRate),
      valueClass: '',
    },
    {
      name: '奖励领取率',
      value: formatPercent(metrics.rewardClaimRate),
      desc: '衡量奖励领取流程是否清晰顺畅',
      status: getMetricStatus('rewardClaimRate', metrics.rewardClaimRate),
      valueClass: '',
    },
    {
      name: '次日回访率',
      value: formatPercent(metrics.returnRate),
      desc: '衡量活动对后续活跃的带动效果',
      status: getMetricStatus('returnRate', metrics.returnRate),
      valueClass: '',
    },
    {
      name: '人均活动成本',
      value: formatCost(metrics.avgCost),
      desc: '衡量单个参与玩家的平均活动投入成本',
      status: getMetricStatus('avgCost', metrics.avgCost),
      valueClass: 'cost',
    },
  ];

  DOM.metricsCards.innerHTML = metricDefs
    .map(
      (m) => `
      <div class="metric-card">
        <div class="metric-name">${m.name}</div>
        <div class="metric-value ${m.valueClass}">${m.value}</div>
        <div class="metric-desc">${m.desc}</div>
        <span class="metric-tag ${m.status.className}">${m.status.label}</span>
      </div>
    `
    )
    .join('');

  DOM.metricsSection.classList.remove('hidden');
}

/** 渲染综合评级 */
function renderRating(rating) {
  const gradeClassMap = {
    A: 'grade-a',
    B: 'grade-b',
    C: 'grade-c',
    D: 'grade-d',
    '—': 'grade-d',
  };

  DOM.ratingCard.innerHTML = `
    <div class="rating-grade ${gradeClassMap[rating.grade] || 'grade-d'}">${rating.grade}</div>
    <div class="rating-label">本次活动综合评级</div>
    <div class="rating-reason">${rating.reason}</div>
    <div class="rating-verdict">${rating.verdict}</div>
  `;

  DOM.ratingSection.classList.remove('hidden');
}

/** 渲染复盘报告 */
function renderReview(html) {
  DOM.reviewContent.innerHTML = html;
  DOM.reviewSection.classList.remove('hidden');
}

/** 隐藏所有结果区域 */
function hideResults() {
  DOM.metricsSection.classList.add('hidden');
  DOM.ratingSection.classList.add('hidden');
  DOM.reviewSection.classList.add('hidden');
}

// ===== 核心流程 =====

/** 主流程：生成复盘 */
function generateReview() {
  // 1. 收集数据
  const data = collectFormData();

  // 2. 校验数据
  const { valid, errors, warnings } = validateData(data);

  // 显示异常提示
  showAlerts(errors, warnings);

  // 如果有致命错误，阻止计算
  if (!valid) {
    hideResults();
    return;
  }

  // 3. 计算指标
  const metrics = calculateMetrics(data);

  // 4. 综合评级
  const rating = calculateRating(metrics);

  // 5. 生成复盘报告
  const reviewHTML = generateReviewHTML(data, metrics, rating);

  // 6. 渲染所有区域
  renderMetrics(metrics);
  renderRating(rating);
  renderReview(reviewHTML);

  // 滚动到指标看板
  DOM.metricsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ===== 示例数据 =====

/** 填入示例数据 */
function fillSampleData() {
  DOM.activityName.value = '夏日登录福利活动';
  DOM.activityType.value = '登录活动';
  DOM.targetUser.value = '活跃玩家';
  DOM.activityGoal.value = '提升留存';
  DOM.activityPeriod.value = '2026.07.01 - 2026.07.07';

  DOM.exposureCount.value = 10000;
  DOM.participantCount.value = 3200;
  DOM.completionCount.value = 1800;
  DOM.rewardClaimCount.value = 1600;
  DOM.returnCount.value = 900;
  DOM.totalCost.value = 5000;
}

/* ============================================================
   热门游戏活动配置模板
   数据为模拟运营场景的参考值，非真实数据
   ============================================================ */

const GAME_TEMPLATES = [
  {
    game: '原神',
    templates: [
      {
        label: '原神 - 海灯节登录活动',
        activityName: '海灯节归灯祈福',
        activityType: '登录活动',
        targetUser: '活跃玩家',
        activityGoal: '提升留存',
        activityPeriod: '2026.02.05 - 2026.02.19',
        exposureCount: 8500000,
        participantCount: 5100000,
        completionCount: 3820000,
        rewardClaimCount: 3550000,
        returnCount: 2290000,
        totalCost: 1200000,
      },
      {
        label: '原神 - 角色祈愿活动',
        activityName: '枫丹角色限定祈愿',
        activityType: '抽卡活动',
        targetUser: '付费玩家',
        activityGoal: '提升付费',
        activityPeriod: '2026.06.18 - 2026.07.09',
        exposureCount: 9200000,
        participantCount: 2760000,
        completionCount: 1100000,
        rewardClaimCount: 980000,
        returnCount: 2070000,
        totalCost: 3500000,
      },
      {
        label: '原神 - 秘境挑战活动',
        activityName: '深境螺旋倍率挑战',
        activityType: '副本挑战',
        targetUser: '活跃玩家',
        activityGoal: '提升活跃',
        activityPeriod: '2026.07.01 - 2026.07.16',
        exposureCount: 6000000,
        participantCount: 1800000,
        completionCount: 720000,
        rewardClaimCount: 680000,
        returnCount: 900000,
        totalCost: 800000,
      },
    ],
  },
  {
    game: '王者荣耀',
    templates: [
      {
        label: '王者荣耀 - 周年庆登录活动',
        activityName: '七周年限定皮肤登录送',
        activityType: '登录活动',
        targetUser: '全体玩家',
        activityGoal: '提升留存',
        activityPeriod: '2026.10.28 - 2026.11.11',
        exposureCount: 12000000,
        participantCount: 7200000,
        completionCount: 5400000,
        rewardClaimCount: 5100000,
        returnCount: 3240000,
        totalCost: 2000000,
      },
      {
        label: '王者荣耀 - 赛季充值返利',
        activityName: 'S35赛季充值返利',
        activityType: '充值活动',
        targetUser: '付费玩家',
        activityGoal: '提升付费',
        activityPeriod: '2026.07.01 - 2026.07.31',
        exposureCount: 8000000,
        participantCount: 1600000,
        completionCount: 960000,
        rewardClaimCount: 880000,
        returnCount: 720000,
        totalCost: 5000000,
      },
      {
        label: '王者荣耀 - 排位冲刺活动',
        activityName: '赛季末排位冲刺挑战',
        activityType: '排行榜活动',
        targetUser: '活跃玩家',
        activityGoal: '提升活跃',
        activityPeriod: '2026.06.20 - 2026.06.30',
        exposureCount: 10000000,
        participantCount: 4500000,
        completionCount: 2250000,
        rewardClaimCount: 2025000,
        returnCount: 1800000,
        totalCost: 1500000,
      },
    ],
  },
  {
    game: '和平精英',
    templates: [
      {
        label: '和平精英 - 夏日庆典登录',
        activityName: '夏日派对连续登录',
        activityType: '登录活动',
        targetUser: '全体玩家',
        activityGoal: '提升留存',
        activityPeriod: '2026.07.10 - 2026.07.24',
        exposureCount: 7000000,
        participantCount: 2940000,
        completionCount: 1764000,
        rewardClaimCount: 1587600,
        returnCount: 940000,
        totalCost: 900000,
      },
      {
        label: '和平精英 - 军需抽奖',
        activityName: '限定载具军需抽奖',
        activityType: '抽卡活动',
        targetUser: '付费玩家',
        activityGoal: '提升付费',
        activityPeriod: '2026.06.15 - 2026.07.15',
        exposureCount: 5500000,
        participantCount: 1100000,
        completionCount: 440000,
        rewardClaimCount: 396000,
        returnCount: 330000,
        totalCost: 2800000,
      },
    ],
  },
  {
    game: '崩坏：星穹铁道',
    templates: [
      {
        label: '星铁 - 角色光锥活动',
        activityName: '仙舟角色限定跃迁',
        activityType: '抽卡活动',
        targetUser: '付费玩家',
        activityGoal: '提升付费',
        activityPeriod: '2026.07.10 - 2026.07.31',
        exposureCount: 4500000,
        participantCount: 1350000,
        completionCount: 540000,
        rewardClaimCount: 486000,
        returnCount: 810000,
        totalCost: 1800000,
      },
      {
        label: '星铁 - 模拟宇宙挑战',
        activityName: '模拟宇宙第九世界挑战',
        activityType: '副本挑战',
        targetUser: '活跃玩家',
        activityGoal: '提升活跃',
        activityPeriod: '2026.06.25 - 2026.07.09',
        exposureCount: 3800000,
        participantCount: 1710000,
        completionCount: 1026000,
        rewardClaimCount: 950000,
        returnCount: 855000,
        totalCost: 600000,
      },
    ],
  },
  {
    game: '明日方舟',
    templates: [
      {
        label: '明日方舟 - 限定卡池活动',
        activityName: '联动限定寻访',
        activityType: '抽卡活动',
        targetUser: '付费玩家',
        activityGoal: '提升付费',
        activityPeriod: '2026.07.01 - 2026.07.15',
        exposureCount: 3200000,
        participantCount: 960000,
        completionCount: 384000,
        rewardClaimCount: 345600,
        returnCount: 576000,
        totalCost: 1200000,
      },
      {
        label: '明日方舟 - 危机合约',
        activityName: '危机合约#12赛季',
        activityType: '副本挑战',
        targetUser: '活跃玩家',
        activityGoal: '提高任务完成率',
        activityPeriod: '2026.06.20 - 2026.07.04',
        exposureCount: 2800000,
        participantCount: 1260000,
        completionCount: 630000,
        rewardClaimCount: 567000,
        returnCount: 504000,
        totalCost: 400000,
      },
    ],
  },
  {
    game: '阴阳师',
    templates: [
      {
        label: '阴阳师 - 神龛礼包活动',
        activityName: '新月同游神龛返利',
        activityType: '充值活动',
        targetUser: '付费玩家',
        activityGoal: '提升付费',
        activityPeriod: '2026.07.01 - 2026.07.14',
        exposureCount: 2000000,
        participantCount: 400000,
        completionCount: 200000,
        rewardClaimCount: 180000,
        returnCount: 160000,
        totalCost: 800000,
      },
      {
        label: '阴阳师 - 退治回归活动',
        activityName: '式神退治老玩家回归',
        activityType: '回流活动',
        targetUser: '回流玩家',
        activityGoal: '促进回流',
        activityPeriod: '2026.06.15 - 2026.07.15',
        exposureCount: 1800000,
        participantCount: 540000,
        completionCount: 270000,
        rewardClaimCount: 243000,
        returnCount: 162000,
        totalCost: 500000,
      },
    ],
  },
  {
    game: '蛋仔派对',
    templates: [
      {
        label: '蛋仔派对 - 节日登录活动',
        activityName: '儿童节连续登录送蛋币',
        activityType: '登录活动',
        targetUser: '全体玩家',
        activityGoal: '提升留存',
        activityPeriod: '2026.06.01 - 2026.06.07',
        exposureCount: 6000000,
        participantCount: 3600000,
        completionCount: 2880000,
        rewardClaimCount: 2736000,
        returnCount: 1800000,
        totalCost: 1000000,
      },
      {
        label: '蛋仔派对 - 盲盒抽奖',
        activityName: '联动盲盒限定抽奖',
        activityType: '抽卡活动',
        targetUser: '活跃玩家',
        activityGoal: '提升付费',
        activityPeriod: '2026.07.05 - 2026.07.20',
        exposureCount: 5000000,
        participantCount: 1500000,
        completionCount: 600000,
        rewardClaimCount: 540000,
        returnCount: 750000,
        totalCost: 1600000,
      },
    ],
  },
  {
    game: '第五人格',
    templates: [
      {
        label: '第五人格 - 赛季推理活动',
        activityName: '第十四赛季推理之径',
        activityType: '登录活动',
        targetUser: '活跃玩家',
        activityGoal: '提升留存',
        activityPeriod: '2026.07.01 - 2026.09.30',
        exposureCount: 3500000,
        participantCount: 1400000,
        completionCount: 700000,
        rewardClaimCount: 630000,
        returnCount: 420000,
        totalCost: 600000,
      },
      {
        label: '第五人格 - 回流补给站',
        activityName: '老玩家回归补给站',
        activityType: '回流活动',
        targetUser: '回流玩家',
        activityGoal: '促进回流',
        activityPeriod: '2026.06.20 - 2026.07.20',
        exposureCount: 2800000,
        participantCount: 560000,
        completionCount: 252000,
        rewardClaimCount: 226800,
        returnCount: 140000,
        totalCost: 350000,
      },
    ],
  },
];

/** 初始化游戏模板下拉框 */
function initGameTemplates() {
  const select = DOM.gameTemplate;
  // 按游戏分组添加 optgroup
  for (const game of GAME_TEMPLATES) {
    const group = document.createElement('optgroup');
    group.label = game.game;
    for (const tpl of game.templates) {
      const opt = document.createElement('option');
      opt.value = tpl.label;
      opt.textContent = tpl.label;
      // 将模板数据存在 option 上
      opt.dataset.template = JSON.stringify(tpl);
      group.appendChild(opt);
    }
    select.appendChild(group);
  }
}

/** 载入选中的游戏模板 */
function loadGameTemplate() {
  const select = DOM.gameTemplate;
  const selected = select.options[select.selectedIndex];
  if (!selected || !selected.value) {
    showToast('请先选择一个游戏活动模板', 'error');
    return;
  }

  const tpl = JSON.parse(selected.dataset.template);

  DOM.activityName.value = tpl.activityName;
  DOM.activityType.value = tpl.activityType;
  DOM.targetUser.value = tpl.targetUser;
  DOM.activityGoal.value = tpl.activityGoal;
  DOM.activityPeriod.value = tpl.activityPeriod;
  DOM.exposureCount.value = tpl.exposureCount;
  DOM.participantCount.value = tpl.participantCount;
  DOM.completionCount.value = tpl.completionCount;
  DOM.rewardClaimCount.value = tpl.rewardClaimCount;
  DOM.returnCount.value = tpl.returnCount;
  DOM.totalCost.value = tpl.totalCost;

  showToast(`已载入「${tpl.label}」模板数据`, 'success');
}

// ===== 示例数据（保留原有） =====

/** 填入示例数据 */
function fillSampleData() {
  DOM.activityName.value = '夏日登录福利活动';
  DOM.activityType.value = '登录活动';
  DOM.targetUser.value = '活跃玩家';
  DOM.activityGoal.value = '提升留存';
  DOM.activityPeriod.value = '2026.07.01 - 2026.07.07';

  DOM.exposureCount.value = 10000;
  DOM.participantCount.value = 3200;
  DOM.completionCount.value = 1800;
  DOM.rewardClaimCount.value = 1600;
  DOM.returnCount.value = 900;
  DOM.totalCost.value = 5000;
}

// ===== 清空数据 =====

/** 清空所有数据和显示 */
function clearAll() {
  // 清空基础信息
  DOM.activityName.value = '';
  DOM.activityType.value = '';
  DOM.targetUser.value = '';
  DOM.activityGoal.value = '';
  DOM.activityPeriod.value = '';

  // 清空数据录入
  DOM.exposureCount.value = '';
  DOM.participantCount.value = '';
  DOM.completionCount.value = '';
  DOM.rewardClaimCount.value = '';
  DOM.returnCount.value = '';
  DOM.totalCost.value = '';

  // 隐藏结果区域
  hideResults();
  hideAlerts();

  // 滚动到顶部
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ===== 事件绑定 =====

DOM.btnSample.addEventListener('click', fillSampleData);
DOM.btnGenerate.addEventListener('click', generateReview);
DOM.btnClear.addEventListener('click', clearAll);
DOM.btnLoadTemplate.addEventListener('click', loadGameTemplate);

/* ============================================================
   导入功能模块
   支持：Excel(.xlsx)、WPS表格、CSV、Markdown、粘贴文本
   ============================================================ */

// ===== 导入功能 DOM 引用 =====
const IMPORT_DOM = {
  fileInput: document.getElementById('fileInput'),
  btnPasteToggle: document.getElementById('btnPasteToggle'),
  pasteArea: document.getElementById('pasteArea'),
  pasteContent: document.getElementById('pasteContent'),
  btnPasteImport: document.getElementById('btnPasteImport'),
  toast: document.getElementById('toast'),
};

// ===== Toast 提示 =====
let _toastTimer = null;
function showToast(message, type = 'success') {
  const toast = IMPORT_DOM.toast;
  toast.textContent = message;
  toast.className = `toast toast-${type}`;
  // 强制回流后显示动画
  void toast.offsetWidth;
  toast.classList.add('toast-show');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => {
    toast.classList.remove('toast-show');
  }, 3000);
}

// ===== 字段别名映射表 =====
// 用于智能匹配 Excel/CSV/Markdown 中的列名
const FIELD_ALIASES = {
  activityName:     ['活动名称', '活动名', '名称', 'activity_name', 'name'],
  activityType:     ['活动类型', '类型', 'activity_type', 'type'],
  targetUser:       ['目标用户', '用户群体', 'target_user', 'user'],
  activityGoal:     ['活动目标', '目标', 'activity_goal', 'goal'],
  activityPeriod:   ['活动周期', '活动时间', '周期', '时间', 'activity_period', 'period'],
  exposureCount:    ['曝光人数', '曝光', 'exposure_count', 'exposure'],
  participantCount: ['参与人数', '参与', 'participant_count', 'participant'],
  completionCount:  ['完成人数', '完成', 'completion_count', 'completion'],
  rewardClaimCount: ['奖励领取人数', '奖励领取', '领取人数', 'reward_claim_count', 'reward'],
  returnCount:      ['次日回访人数', '次日回访', '回访人数', '回访', 'return_count', 'return'],
  totalCost:        ['活动总成本', '总成本', '成本', 'total_cost', 'cost'],
};

/** 智能匹配表头到字段名 */
function matchField(header) {
  const h = String(header).trim().toLowerCase();
  if (!h) return null;
  // 优先精确匹配
  for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
    if (aliases.some(a => h === a.toLowerCase())) return field;
  }
  // 其次包含匹配
  for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
    if (aliases.some(a => h.includes(a.toLowerCase()) || a.toLowerCase().includes(h))) return field;
  }
  return null;
}

// ===== 格式检测与字段提取 =====

/**
 * 将二维数组（rows）映射为字段对象
 * 自动识别「字段-值」纵向格式和「表头-数据」横向格式
 */
function mapRowsToFields(rows) {
  if (!rows || rows.length === 0) return {};

  // 过滤完全空行
  rows = rows.filter(r => r.some(c => String(c).trim() !== ''));

  if (rows.length === 0) return {};

  const firstRow = rows[0];
  const nonEmptyCount = firstRow.filter(c => String(c).trim() !== '').length;

  // 2 列及以下 → 纵向「字段-值」格式
  if (nonEmptyCount <= 2) {
    return parseKeyValueRows(rows);
  }
  // 多列 → 横向「表头-数据」格式
  return parseHeaderRowFormat(rows);
}

/** 解析纵向「字段-值」格式 */
function parseKeyValueRows(rows) {
  const result = {};
  for (const row of rows) {
    const key = String(row[0] || '').trim();
    const value = row[1] !== undefined ? String(row[1] || '').trim() : '';
    if (!key) continue;
    const field = matchField(key);
    if (field && value) {
      result[field] = value;
    }
  }
  return result;
}

/** 解析横向「表头-数据」格式 */
function parseHeaderRowFormat(rows) {
  if (rows.length < 2) return {};
  const headers = rows[0];
  const dataRow = rows[1];
  const result = {};
  for (let i = 0; i < headers.length; i++) {
    const header = String(headers[i] || '').trim();
    if (!header) continue;
    const field = matchField(header);
    if (field && dataRow[i] !== undefined && String(dataRow[i]).trim() !== '') {
      result[field] = String(dataRow[i]).trim();
    }
  }
  return result;
}

// ===== 填充表单 =====

/** 将导入的字段对象填充到表单中，返回成功填充的字段数 */
function fillFormFromImport(fields) {
  const fieldToElement = {
    activityName: DOM.activityName,
    activityType: DOM.activityType,
    targetUser: DOM.targetUser,
    activityGoal: DOM.activityGoal,
    activityPeriod: DOM.activityPeriod,
    exposureCount: DOM.exposureCount,
    participantCount: DOM.participantCount,
    completionCount: DOM.completionCount,
    rewardClaimCount: DOM.rewardClaimCount,
    returnCount: DOM.returnCount,
    totalCost: DOM.totalCost,
  };

  let filledCount = 0;
  for (const [field, value] of Object.entries(fields)) {
    const el = fieldToElement[field];
    if (!el || !value) continue;

    if (el.tagName === 'SELECT') {
      // 下拉框需精确匹配 option
      const options = Array.from(el.options);
      const match = options.find(opt => opt.value === value || opt.textContent === value);
      if (match) {
        el.value = match.value;
        filledCount++;
      }
    } else {
      el.value = value;
      filledCount++;
    }
  }
  return filledCount;
}

// ===== CSV 解析 =====

/** 解析 CSV 文本，返回二维数组，支持逗号/分号/制表符分隔及引号包裹 */
function parseCSV(text) {
  // 去除 BOM
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);

  const rows = [];
  let row = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',' || char === ';' || char === '\t') {
        row.push(current);
        current = '';
      } else if (char === '\n') {
        row.push(current);
        rows.push(row);
        row = [];
        current = '';
      } else if (char === '\r') {
        // 跳过，由 \n 处理换行
      } else {
        current += char;
      }
    }
  }

  // 最后一行
  if (current !== '' || row.length > 0) {
    row.push(current);
    rows.push(row);
  }

  // 过滤空行
  return rows.filter(r => r.some(c => String(c).trim() !== ''));
}

// ===== Markdown 表格解析 =====

/** 解析 Markdown 表格文本，返回二维数组 */
function parseMarkdownTable(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.includes('|'));

  if (lines.length < 2) return null;

  const rows = [];
  for (const line of lines) {
    // 跳过分隔行（|---|---|）
    if (/^[\s|:\-]+$/.test(line) && line.includes('-')) continue;

    const cells = line.split('|');
    // 去掉首尾空元素（由行首/行尾的 | 产生）
    if (cells[0].trim() === '') cells.shift();
    if (cells[cells.length - 1].trim() === '') cells.pop();

    rows.push(cells.map(c => c.trim()));
  }

  return rows.length > 0 ? rows : null;
}

// ===== 粘贴文本解析 =====

/** 自动检测粘贴文本格式并解析为二维数组 */
function parsePastedText(text) {
  if (!text || !text.trim()) return null;

  // 1. 尝试 Markdown 表格（含 | 和 ---）
  if (text.includes('|') && text.includes('---')) {
    const md = parseMarkdownTable(text);
    if (md) return md;
  }

  // 2. 尝试竖线分隔表格（含 | 但无 ---）
  if (text.includes('|') && text.includes('\n')) {
    const lines = text.trim().split('\n').filter(l => l.trim());
    const rows = lines.map(line =>
      line.split('|').map(c => c.trim()).filter(c => c !== '')
    );
    // 验证是否为合理表格（每行列数相近）
    if (rows.length >= 2 && rows.every(r => r.length >= 1)) {
      return rows;
    }
  }

  // 3. 尝试 Tab 分隔（从 Excel/WPS 直接复制）
  if (text.includes('\t')) {
    return text.trim().split('\n')
      .filter(line => line.trim())
      .map(line => line.split('\t'));
  }

  // 4. 尝试 CSV（逗号分隔）
  if (text.includes(',')) {
    return parseCSV(text);
  }

  // 5. 尝试换行分隔的「字段:值」或「字段 值」
  const lines = text.trim().split('\n').filter(l => l.trim());
  if (lines.length >= 2) {
    const rows = lines.map(line => {
      // 尝试冒号、空格、等号分隔
      const parts = line.split(/[:：=]/);
      if (parts.length >= 2) return [parts[0].trim(), parts.slice(1).join(':').trim()];
      return [line.trim()];
    });
    if (rows.every(r => r.length === 2)) return rows;
  }

  return null;
}

// ===== XLSX 解析（纯 JS，无外部依赖） =====

/**
 * 解析 .xlsx 文件（ZIP + XML）
 * 使用浏览器内置 DecompressionStream 解压，DOMParser 解析 XML
 */
async function parseXLSX(arrayBuffer) {
  const uint8 = new Uint8Array(arrayBuffer);
  const entries = findZipEntries(uint8);

  // 提取 sharedStrings（共享字符串表）
  let sharedStrings = [];
  const ssEntry = entries['xl/sharedStrings.xml'] || entries['xl/SharedStrings.xml'];
  if (ssEntry) {
    const xml = await decompressZipEntry(ssEntry);
    sharedStrings = parseSharedStringsXML(xml);
  }

  // 提取 sheet 数据（优先 sheet1，退而求其次任意 sheet）
  let sheetXml = null;
  const sheetKeys = Object.keys(entries).filter(k => /xl\/worksheets\/sheet\d+\.xml$/i.test(k));
  if (sheetKeys.length > 0) {
    sheetXml = await decompressZipEntry(entries[sheetKeys[0]]);
  }
  if (!sheetXml) throw new Error('未找到工作表数据');

  const rows = parseSheetXML(sheetXml, sharedStrings);
  if (rows.length === 0) throw new Error('工作表中无数据');
  return rows;
}

/** 扫描 ZIP 文件中的本地文件头，返回 { filename: { compressionMethod, data, compressedSize } } */
function findZipEntries(uint8) {
  const entries = {};
  const view = new DataView(uint8.buffer, uint8.byteOffset, uint8.byteLength);
  // PK\x03\x04 = 本地文件头签名
  const SIG = [0x50, 0x4b, 0x03, 0x04];

  for (let i = 0; i < uint8.length - 30; i++) {
    if (uint8[i] !== SIG[0] || uint8[i + 1] !== SIG[1] ||
        uint8[i + 2] !== SIG[2] || uint8[i + 3] !== SIG[3]) continue;

    const compressionMethod = view.getUint16(i + 4, true);
    const compressedSize = view.getUint32(i + 18, true);
    const filenameLength = view.getUint16(i + 26, true);
    const extraFieldLength = view.getUint16(i + 28, true);

    const filenameStart = i + 30;
    const filename = new TextDecoder('utf-8').decode(
      uint8.slice(filenameStart, filenameStart + filenameLength)
    );

    const dataStart = filenameStart + filenameLength + extraFieldLength;

    // compressedSize 为 0 时可能使用了数据描述符，尝试扫描到下一个签名
    let actualSize = compressedSize;
    if (compressedSize === 0) {
      actualSize = findNextSignature(uint8, dataStart) - dataStart;
    }

    entries[filename] = {
      compressionMethod,
      data: uint8.slice(dataStart, dataStart + actualSize),
    };
  }

  return entries;
}

/** 从指定位置向后查找下一个 ZIP 签名，返回其偏移量 */
function findNextSignature(uint8, start) {
  for (let i = start; i < uint8.length - 3; i++) {
    if (uint8[i] === 0x50 && uint8[i + 1] === 0x4b) {
      // PK\x03\x04 或 PK\x01\x02 或 PK\x07\x08
      if (uint8[i + 2] === 0x03 && uint8[i + 3] === 0x04) return i;
      if (uint8[i + 2] === 0x01 && uint8[i + 3] === 0x02) return i;
      if (uint8[i + 2] === 0x07 && uint8[i + 3] === 0x08) return i + 4 + 12; // 跳过数据描述符
    }
  }
  return uint8.length;
}

/** 解压 ZIP 条目，返回 UTF-8 字符串 */
async function decompressZipEntry(entry) {
  if (entry.compressionMethod === 0) {
    // Method 0: Stored（无压缩）
    return new TextDecoder('utf-8').decode(entry.data);
  }
  if (entry.compressionMethod === 8) {
    // Method 8: DEFLATE（使用浏览器原生 DecompressionStream）
    if (typeof DecompressionStream === 'undefined') {
      throw new Error('当前浏览器不支持 DecompressionStream，无法解析 xlsx');
    }
    const ds = new DecompressionStream('deflate-raw');
    const stream = new Blob([entry.data]).stream().pipeThrough(ds);
    const buffer = await new Response(stream).arrayBuffer();
    return new TextDecoder('utf-8').decode(buffer);
  }
  throw new Error('不支持的 ZIP 压缩方法: ' + entry.compressionMethod);
}

/** 解析 sharedStrings.xml，返回字符串数组 */
function parseSharedStringsXML(xml) {
  const doc = new DOMParser().parseFromString(xml, 'text/xml');
  const sis = doc.getElementsByTagName('si');
  const strings = [];
  for (const si of sis) {
    // 处理 <t>直接文本</t> 和 <r><t>富文本</t></r> 两种情况
    const ts = si.getElementsByTagName('t');
    let text = '';
    for (const t of ts) text += t.textContent;
    strings.push(text);
  }
  return strings;
}

/** 将 Excel 列字母（A, B, AA）转为 0 起始索引 */
function colLetterToIndex(letters) {
  let index = 0;
  for (let i = 0; i < letters.length; i++) {
    index = index * 26 + (letters.charCodeAt(i) - 64);
  }
  return index - 1;
}

/** 解析 sheet XML，返回二维数组 */
function parseSheetXML(xml, sharedStrings) {
  const doc = new DOMParser().parseFromString(xml, 'text/xml');
  const rows = [];
  const rowElements = doc.getElementsByTagName('row');

  for (const row of rowElements) {
    const cells = row.getElementsByTagName('c');
    const rowData = [];

    for (const cell of cells) {
      const ref = cell.getAttribute('r') || '';
      const type = cell.getAttribute('t');
      const vElement = cell.getElementsByTagName('v')[0];
      const isElement = cell.getElementsByTagName('is')[0]; // inline string

      let value = '';

      if (type === 's' && vElement) {
        // 共享字符串
        value = sharedStrings[parseInt(vElement.textContent, 10)] || '';
      } else if (type === 'inlineStr' && isElement) {
        // 内联字符串
        const ts = isElement.getElementsByTagName('t');
        for (const t of ts) value += t.textContent;
      } else if (vElement) {
        value = vElement.textContent;
      }

      // 提取列索引（如 "B2" → 1）
      const colMatch = ref.match(/^([A-Z]+)/);
      const colIndex = colMatch ? colLetterToIndex(colMatch[1]) : rowData.length;

      rowData[colIndex] = value;
    }

    // 填补空位
    for (let i = 0; i < rowData.length; i++) {
      if (rowData[i] === undefined) rowData[i] = '';
    }

    rows.push(rowData);
  }

  return rows;
}

// ===== 文件解析入口 =====

/** 根据文件扩展名选择解析器，返回二维数组 */
async function parseFile(file) {
  const ext = (file.name.split('.').pop() || '').toLowerCase();

  if (ext === 'xlsx') {
    const buffer = await file.arrayBuffer();
    return await parseXLSX(buffer);
  }

  const text = await file.text();

  if (ext === 'csv') return parseCSV(text);

  if (ext === 'md' || ext === 'markdown') {
    const md = parseMarkdownTable(text);
    if (!md) throw new Error('Markdown 文件中未找到有效的表格数据');
    return md;
  }

  // .txt 或未知扩展名 → 自动检测
  const parsed = parsePastedText(text);
  if (parsed) return parsed;

  throw new Error('无法识别文件格式，请使用 xlsx、csv、md 格式');
}

// ===== 导入事件处理 =====

/** 处理文件导入 */
async function handleFileImport(event) {
  const file = event.target.files[0];
  if (!file) return;

  try {
    const rows = await parseFile(file);
    if (!rows || rows.length === 0) {
      showToast('未识别到有效数据', 'error');
      return;
    }

    const fields = mapRowsToFields(rows);
    const matchedCount = Object.keys(fields).length;

    if (matchedCount === 0) {
      showToast('未能识别到有效字段，请检查表头名称', 'error');
      return;
    }

    const filledCount = fillFormFromImport(fields);
    if (filledCount === 0) {
      showToast('字段匹配但填充失败，请检查数据格式', 'error');
    } else {
      showToast(`成功导入 ${filledCount} 个字段，可点击「生成复盘」`, 'success');
    }
  } catch (error) {
    showToast('导入失败：' + error.message, 'error');
  }

  // 重置 input 以允许重复选择同一文件
  event.target.value = '';
}

/** 处理粘贴导入 */
function handlePasteImport() {
  const text = IMPORT_DOM.pasteContent.value.trim();
  if (!text) {
    showToast('请先粘贴数据', 'error');
    return;
  }

  const rows = parsePastedText(text);
  if (!rows || rows.length === 0) {
    showToast('未识别到有效数据，请检查格式', 'error');
    return;
  }

  const fields = mapRowsToFields(rows);
  const matchedCount = Object.keys(fields).length;

  if (matchedCount === 0) {
    showToast('未能识别到有效字段，请检查表头名称', 'error');
    return;
  }

  const filledCount = fillFormFromImport(fields);
  if (filledCount === 0) {
    showToast('字段匹配但填充失败，请检查数据格式', 'error');
  } else {
    showToast(`成功导入 ${filledCount} 个字段，可点击「生成复盘」`, 'success');
    IMPORT_DOM.pasteArea.classList.add('hidden');
    IMPORT_DOM.pasteContent.value = '';
  }
}

// ===== 导入事件绑定 =====

IMPORT_DOM.fileInput.addEventListener('change', handleFileImport);

IMPORT_DOM.btnPasteToggle.addEventListener('click', () => {
  IMPORT_DOM.pasteArea.classList.toggle('hidden');
  if (!IMPORT_DOM.pasteArea.classList.contains('hidden')) {
    IMPORT_DOM.pasteContent.focus();
  }
});

IMPORT_DOM.btnPasteImport.addEventListener('click', handlePasteImport);

// ===== 页面初始化 =====
initGameTemplates();
console.log('游戏活动运营数据小助手已就绪');