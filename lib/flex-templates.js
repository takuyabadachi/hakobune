/**
 * Flex Message Templates for LINE
 * Rich card/carousel layouts for in-LINE data display
 */

/**
 * Help menu — shows all available commands
 */
export function helpFlex() {
  return {
    type: 'flex',
    altText: 'Hakobune AI — 使い方ガイド',
    contents: {
      type: 'bubble',
      size: 'mega',
      header: {
        type: 'box',
        layout: 'vertical',
        contents: [
          { type: 'text', text: '🚢 Hakobune AI', weight: 'bold', size: 'lg', color: '#1d1d1f' },
          { type: 'text', text: '業務アシスタント ガイド', size: 'xs', color: '#86868b', margin: 'sm' },
        ],
        backgroundColor: '#f5f5f7',
        paddingAll: '16px',
      },
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'md',
        contents: [
          sectionTitle('✍️ 文章作成'),
          cmdRow('そのまま送信', '対外連絡文を作成'),
          separator(),
          sectionTitle('📋 情報整理'),
          cmdRow('#議事録', 'メモ → 構造化議事録'),
          cmdRow('#整理', '散在情報の要約'),
          separator(),
          sectionTitle('📐 テンプレート'),
          cmdRow('#テンプレ', 'マニュアル・指示書'),
          cmdRow('#経理', '税理士への質問文'),
          cmdRow('#SNS', '投稿文作成'),
          separator(),
          sectionTitle('🔍 検索・管理'),
          cmdRow('#振り返り', '過去の会話検索'),
          separator(),
          sectionTitle('⚙️ その他'),
          cmdRow('#reset', '会話リセット'),
          cmdRow('#記録停止', '発言記録を停止'),
          cmdRow('#記録再開', '発言記録を再開'),
        ],
        paddingAll: '16px',
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: '💡 戦略・企画・分析はCOptO AIへ',
            size: 'xxs',
            color: '#86868b',
            align: 'center',
          },
        ],
        paddingAll: '12px',
        backgroundColor: '#f5f5f7',
      },
    },
  };
}

/**
 * Privacy notice — shown when bot joins a group
 */
export function privacyNoticeFlex() {
  return {
    type: 'flex',
    altText: 'Hakobune AI — ご案内',
    contents: {
      type: 'bubble',
      size: 'kilo',
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'md',
        contents: [
          { type: 'text', text: '🚢 Hakobune AI', weight: 'bold', size: 'md' },
          { type: 'text', text: 'グループに参加しました', size: 'sm', color: '#86868b' },
          { type: 'separator', margin: 'md' },
          {
            type: 'text',
            text: '業務管理・会話検索のため、このグループの会話を記録します。\n\n記録を停止したい方は #記録停止 と送信してください。',
            size: 'xs',
            color: '#555555',
            wrap: true,
            margin: 'md',
          },
          { type: 'separator', margin: 'md' },
          {
            type: 'text',
            text: '#help で使い方をご確認ください',
            size: 'xs',
            color: '#86868b',
            margin: 'sm',
          },
        ],
        paddingAll: '16px',
      },
    },
  };
}

/**
 * Conversation review results — show search results as a bubble
 */
export function reviewResultsFlex(query, results) {
  const items = results.slice(0, 10).map(r => {
    const time = new Date(r.created_at).toLocaleString('ja-JP', {
      timeZone: 'Asia/Tokyo',
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
    return {
      type: 'box',
      layout: 'vertical',
      spacing: 'xs',
      contents: [
        {
          type: 'text',
          text: `${time} ${r.display_name}`,
          size: 'xxs',
          color: '#86868b',
        },
        {
          type: 'text',
          text: (r.content || '').slice(0, 100),
          size: 'xs',
          wrap: true,
        },
      ],
      margin: 'md',
    };
  });

  if (items.length === 0) {
    items.push({
      type: 'text',
      text: '該当する会話が見つかりませんでした',
      size: 'sm',
      color: '#86868b',
      margin: 'md',
    });
  }

  return {
    type: 'flex',
    altText: `振り返り結果：${query}`,
    contents: {
      type: 'bubble',
      size: 'mega',
      header: {
        type: 'box',
        layout: 'vertical',
        contents: [
          { type: 'text', text: '🔍 振り返り結果', weight: 'bold', size: 'sm' },
          { type: 'text', text: `「${query}」`, size: 'xs', color: '#86868b', margin: 'xs' },
        ],
        backgroundColor: '#f5f5f7',
        paddingAll: '14px',
      },
      body: {
        type: 'box',
        layout: 'vertical',
        contents: items,
        paddingAll: '14px',
      },
    },
  };
}

// ─── Helpers ───

function sectionTitle(text) {
  return { type: 'text', text, weight: 'bold', size: 'sm', color: '#1d1d1f' };
}

function cmdRow(cmd, desc) {
  return {
    type: 'box',
    layout: 'horizontal',
    contents: [
      { type: 'text', text: cmd, size: 'xs', color: '#0066cc', flex: 3 },
      { type: 'text', text: desc, size: 'xs', color: '#555555', flex: 5, wrap: true },
    ],
    margin: 'sm',
  };
}

function separator() {
  return { type: 'separator', margin: 'md' };
}
