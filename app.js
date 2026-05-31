const { createApp, ref, computed } = Vue;

createApp({
  setup() {
    // ===== 输入状态 =====
    const productName = ref('');
    const sellingPoint = ref('');
    const selectedStyle = ref('product');
    const selectedAudiences = ref([]);
    const showAdvanced = ref(false);
    const generating = ref(false);
    const results = ref([]);
    const errorMsg = ref('');
    const copiedIndex = ref(-1);

    // ===== 配额管理 =====
    const dailyLimit = 3;
    const storageKey = 'xhs_usage';

    function getUsage() {
      try {
        const raw = localStorage.getItem(storageKey);
        if (!raw) return { date: '', count: 0 };
        return JSON.parse(raw);
      } catch { return { date: '', count: 0 }; }
    }

    function saveUsage(data) {
      localStorage.setItem(storageKey, JSON.stringify(data));
    }

    function getToday() {
      return new Date().toISOString().slice(0, 10);
    }

    function getRemaining() {
      const usage = getUsage();
      if (usage.date !== getToday()) return dailyLimit;
      return Math.max(0, dailyLimit - usage.count);
    }

    const remainingQuota = ref(getRemaining());
    const quotaExhausted = computed(() => remainingQuota.value <= 0);

    function useOneQuota() {
      const today = getToday();
      const usage = getUsage();
      if (usage.date !== today) {
        saveUsage({ date: today, count: 1 });
        remainingQuota.value = dailyLimit - 1;
      } else {
        usage.count += 1;
        saveUsage(usage);
        remainingQuota.value = Math.max(0, dailyLimit - usage.count);
      }
    }

    // ===== 风格配置 =====
    const styles = [
      { label: '产品种草', value: 'product' },
      { label: '促销冲量', value: 'promo' },
      { label: '品牌故事', value: 'brand' },
    ];

    const audiences = ['学生党', '上班族', '宝妈', '护肤小白', '健身爱好者', '数码控'];

    const styleTitles = {
      product: '产品种草',
      promo: '促销冲量',
      brand: '品牌故事',
    };

    // ===== 构建 Prompt =====
    function buildPrompt() {
      const style = styleTitles[selectedStyle.value] || '产品种草';
      const people = selectedAudiences.value.length
        ? '目标人群：' + selectedAudiences.value.join('、')
        : '';
      const sell = sellingPoint.value
        ? '产品卖点：' + sellingPoint.value
        : '';

      return `你是一个小红书专业写手，精通${style}类文案。请根据以下信息生成 5 条小红书文案：

产品名称：${productName.value}
${sell}
文案风格：${style}
${people}

要求：
- 每条 150-300 字，短句为主，一句一行
- 大量使用 emoji（🔥✨💡📢🎁💯），但每条控制在 5-8 个以内
- 开头要有创意（禁止"姐妹们"等老套开头），用场景感、反问、悬念引入
- 结尾加 3-5 个话题标签，格式 #小红书种草 #好物推荐
- 5 条文案角度各不同：痛点切入、场景描述、数据说服、对比评测、情感共鸣
- 口语化、真实感强，读起来像真人写的——不完美反而更可信

直接输出 5 条文案，每条用 --- 分隔。不要额外解释文字。`;
    }

    // ===== 生成文案 =====
    async function generate() {
      if (!productName.value.trim()) {
        errorMsg.value = '请输入产品名或关键词';
        return;
      }

      if (quotaExhausted.value) {
        errorMsg.value = '';
        return;
      }

      errorMsg.value = '';
      results.value = [];
      generating.value = true;

      try {
        const prompt = buildPrompt();

        const response = await fetch('https://api.deepseek.com/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer sk-63261b0efe204043a5bd723fd20ae782',
          },
          body: JSON.stringify({
            model: 'deepseek-chat',
            messages: [
              { role: 'user', content: prompt },
            ],
            temperature: 0.9,
            max_tokens: 3000,
          }),
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.error?.message || 'API 错误 (' + response.status + ')');
        }

        const data = await response.json();
        const raw = data.choices?.[0]?.message?.content || '';

        const texts = raw
          .split('---')
          .map(t => t.trim())
          .filter(t => t.length > 10);

        if (texts.length === 0) {
          throw new Error('生成结果格式异常，请重试');
        }

        results.value = texts;
        useOneQuota();
        scrollToResults();

      } catch (err) {
        if (err.name === 'TypeError' && err.message.includes('fetch')) {
          errorMsg.value = '网络连接失败，请检查网络后重试';
        } else {
          errorMsg.value = err.message || '服务繁忙，请稍后再试';
        }
      } finally {
        generating.value = false;
      }
    }

    // ===== 复制到剪贴板 =====
    async function copy(text, index) {
      try {
        await navigator.clipboard.writeText(text);
        copiedIndex.value = index;
        setTimeout(() => { copiedIndex.value = -1; }, 2000);
      } catch {
        const ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        copiedIndex.value = index;
        setTimeout(() => { copiedIndex.value = -1; }, 2000);
      }
    }

    // ===== 滚动到结果 =====
    function scrollToResults() {
      setTimeout(() => {
        const el = document.querySelector('.results-area');
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }

    return {
      productName,
      sellingPoint,
      selectedStyle,
      selectedAudiences,
      showAdvanced,
      generating,
      results,
      errorMsg,
      copiedIndex,
      remainingQuota,
      dailyLimit,
      quotaExhausted,
      styles,
      audiences,
      generate,
      copy,
    };
  },
}).mount('#app');
